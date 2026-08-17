'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AREA_SCOPED_ROLES } from '@/lib/roles';
import type { AppRole } from '@/lib/initiatives/types';

export type ActionState = { error: string | null };

/**
 * Crear un usuario es, por diseño, la única operación de la app que corre
 * con service_role fuera de un script (ver D8 en decisiones-tecnicas.md):
 * no existe ningún camino en Supabase para que una sesión normal cree las
 * credenciales de otra persona — eso es, correctamente, un privilegio de
 * administrador de la plataforma, no algo que RLS pueda conceder. El
 * control de acceso real está en el chequeo de rol de abajo, en código.
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

  const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/completar-registro`,
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

  revalidatePath('/usuarios');
  redirect('/usuarios');
}
