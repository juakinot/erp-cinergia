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
 *   - Crear notificaciones para OTRO usuario (`src/lib/notifications/notify.ts`):
 *     `notifications_own` en RLS exige `user_id = auth.uid()` también para
 *     el insert, así que la sesión normal solo puede notificarse a sí misma.
 *     El Server Action que llama a `notify()` ya validó la autoridad del
 *     actor antes de escribir la notificación de la otra persona.
 *   - Los contadores de `AppShell` (`src/components/app-shell.tsx`), porque
 *     se envuelven en `unstable_cache` y Next.js no permite leer `cookies()`
 *     (de donde sale el cliente normal) dentro de una función cacheada. Es
 *     seguro acá porque esas consultas ya filtran explícitamente por
 *     `user_id`/`area_id` en el código, no dependen de RLS para acotar el
 *     resultado a la persona correcta — RLS solo actúa como respaldo.
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
