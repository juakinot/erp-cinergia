import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente de Supabase para Client Components. Usa la clave anon — respeta
 * RLS según la sesión del navegador, nunca la bypassa.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
