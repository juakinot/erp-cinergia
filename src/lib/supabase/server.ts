import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Lee la sesión de las cookies de la petición — también respeta
 * RLS, igual que el cliente de navegador.
 *
 * El try/catch en setAll existe porque Server Components no pueden escribir
 * cookies directamente; si este cliente se usa solo para leer (la mayoría de
 * los casos), el error se ignora con seguridad porque el middleware ya se
 * encarga de refrescar la sesión en cada request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Ver comentario de arriba: seguro de ignorar en Server Components.
          }
        },
      },
    }
  );
}
