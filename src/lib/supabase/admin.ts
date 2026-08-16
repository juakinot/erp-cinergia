import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente con la service_role key. Bypassa TODAS las políticas RLS.
 *
 * Uso permitido:
 *   - Scripts de servidor (siembra, scripts/*.mjs).
 *   - Route Handlers que ya verificaron en código que la sesión es
 *     PRESIDENT o REPORTS_DIRECTOR, antes de leer las vistas v_report_*
 *     (ver D8 en docs/decisiones-tecnicas.md — esas vistas no son
 *     accesibles con la clave anon, a propósito).
 *
 * Uso NUNCA permitido: pasar este cliente a un Client Component, o
 * construirlo a partir de una variable NEXT_PUBLIC_*.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient() no debe llamarse desde el navegador.');
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
