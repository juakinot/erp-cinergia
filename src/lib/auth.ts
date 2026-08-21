import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Sesión combinada: identidad de Supabase Auth + perfil de aplicación
 * (rol, área). El middleware ya garantiza que si llegamos aquí hay un
 * usuario autenticado — esta función solo completa el perfil.
 *
 * Se consulta con el cliente normal (clave anon), no con el admin: la
 * política `users_select` de RLS ya permite a cualquiera leer su propia
 * fila, así que no hace falta bypassar nada.
 */
export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, area_id, status, areas(slug, name)')
    .eq('id', authUser.id)
    .single();

  if (error || !profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as
      | 'PRESIDENT'
      | 'AREA_DIRECTOR'
      | 'REPORTS_DIRECTOR'
      | 'COORDINATOR'
      | 'MEMBER'
      | 'DEAN',
    areaId: profile.area_id as string | null,
    // Supabase tipa las relaciones anidadas como arreglo salvo que se
    // declaren tipos generados; con una fila siempre es el primer elemento.
    area: (Array.isArray(profile.areas) ? profile.areas[0] : profile.areas) as
      | { slug: string; name: string }
      | null,
    status: profile.status as 'ACTIVE' | 'INACTIVE' | 'BLOCKED',
  };
}

/** Para Server Components que exigen sesión: redirige si no la hay. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
