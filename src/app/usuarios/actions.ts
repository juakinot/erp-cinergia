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

  if (inviteError || !data.user) {
    // "already been registered" es el mensaje típico si el correo ya existe.
    return { error: `No se pudo invitar: ${inviteError?.message ?? 'error desconocido'}` };
  }

  const { error: profileError } = await admin.from('users').insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    area_id: needsArea ? areaId : null,
  });

  if (profileError) {
    // Sin perfil en public.users la persona quedaría con login pero sin
    // rol ni área — inservible y confuso. Se revierte la cuenta de Auth
    // para no dejar cuentas huérfanas.
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: `Se creó el acceso pero falló el perfil, se revirtió: ${profileError.message}` };
  }

  const hashedToken = data.properties.hashed_token;
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?token_hash=${hashedToken}&type=invite&next=/completar-registro`;

  revalidatePath('/usuarios');
  return { error: null, inviteLink };
}
