'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AREA_SCOPED_ROLES } from '@/lib/roles';
import type { AppRole } from '@/lib/initiatives/types';

export type ActionState = { error: string | null; inviteLink?: string | null };

/**
 * Crear un usuario es, por diseño, la única operación de la app que corre
 * con service_role fuera de un script (ver D8 en decisiones-tecnicas.md):
 * no existe ningún camino en Supabase para que una sesión normal cree las
 * credenciales de otra persona — eso es, correctamente, un privilegio de
 * administrador de la plataforma, no algo que RLS pueda conceder. El
 * control de acceso real está en el chequeo de rol de abajo, en código.
 *
 * Se usa `generateLink` en vez de `inviteUserByEmail` porque el envío de
 * correo real requiere un dominio verificado en Resend (sin eso, el
 * remitente de pruebas de Resend solo entrega a la cuenta dueña de Resend,
 * no a terceros — ver D11/D13 en decisiones-tecnicas.md). `generateLink`
 * crea la cuenta y el token sin intentar enviar nada; Presidencia copia el
 * enlace resultante y se lo entrega a la persona por el canal que prefiera
 * (WhatsApp, correo personal, etc.).
 */
export async function inviteUser(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) redirect('/login');
  if (actor.role !== 'PRESIDENT') {
    return { error: 'Solo Presidencia puede invitar usuarios.' };
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const role = String(formData.get('role') ?? '') as AppRole;
  const areaId = String(formData.get('areaId') ?? '').trim() || null;

  if (!email || !fullName || !role) {
    return { error: 'Completa correo, nombre y rol.' };
  }

  const needsArea = AREA_SCOPED_ROLES.includes(role);
  if (needsArea && !areaId) {
    return { error: 'Este rol requiere seleccionar un área.' };
  }

  const admin = createAdminClient();

  const { data, error: inviteError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: fullName } },
  });

  if (inviteError?.code === 'email_exists') {
    // Ya existe una cuenta de Auth con este correo — típicamente porque un
    // enlace anterior se gastó sin que la persona llegara a definir su
    // contraseña (ver D14). `generateLink` con type "invite" solo sirve
    // para cuentas nuevas; para reactivar una existente se usa "recovery",
    // que lleva al mismo flujo de definir contraseña en /completar-registro.
    return reissueLink({ admin, email, fullName, role, areaId, needsArea });
  }

  if (inviteError || !data.user) {
    return { error: `No se pudo invitar: ${inviteError?.message ?? 'error desconocido'}` };
  }

  // upsert, no insert: `generateLink` con type "invite" puede devolver una
  // cuenta que ya existía (invitada antes pero sin confirmar, sin llegar a
  // disparar `email_exists`) — un insert simple fallaría por PK duplicada.
  const { error: profileError } = await admin.from('users').upsert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    area_id: needsArea ? areaId : null,
  });

  if (profileError) {
    return { error: `No se pudo guardar el perfil: ${profileError.message}` };
  }

  const hashedToken = data.properties.hashed_token;
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?token_hash=${hashedToken}&type=invite&next=/completar-registro`;

  revalidatePath('/usuarios');
  return { error: null, inviteLink };
}

async function reissueLink(params: {
  admin: ReturnType<typeof createAdminClient>;
  email: string;
  fullName: string;
  role: AppRole;
  areaId: string | null;
  needsArea: boolean;
}): Promise<ActionState> {
  const { admin, email, fullName, role, areaId, needsArea } = params;

  const { data: recoveryData, error: recoveryError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  });

  if (recoveryError || !recoveryData.user) {
    return { error: `No se pudo invitar: ${recoveryError?.message ?? 'error desconocido'}` };
  }

  // upsert (no insert): la fila de public.users puede ya existir de un
  // intento anterior — se refresca con el rol/área/nombre actuales en vez
  // de fallar por duplicado.
  const { error: profileError } = await admin.from('users').upsert({
    id: recoveryData.user.id,
    email,
    full_name: fullName,
    role,
    area_id: needsArea ? areaId : null,
  });

  if (profileError) {
    return { error: `No se pudo actualizar el perfil: ${profileError.message}` };
  }

  const hashedToken = recoveryData.properties.hashed_token;
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?token_hash=${hashedToken}&type=recovery&next=/completar-registro`;

  revalidatePath('/usuarios');
  return { error: null, inviteLink };
}
