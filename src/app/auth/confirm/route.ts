import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Punto de entrada único para todo enlace de correo de Supabase Auth
 * (invitación, recuperación de contraseña, confirmación de correo). Se
 * usa como `redirectTo` al invitar (ver src/app/usuarios/actions.ts).
 *
 * Supabase puede llegar aquí de dos formas según cómo esté configurada la
 * plantilla de correo del proyecto:
 *   - `token_hash` + `type`: la plantilla usa {{ .TokenHash }} directamente.
 *   - `code`: la plantilla por defecto pasa primero por el endpoint propio
 *     de Supabase (`/auth/v1/verify`), que redirige aquí con un código PKCE.
 * Se manejan ambos casos para no depender de personalizar la plantilla en
 * el dashboard de Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/completar-registro';

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect('/login?error=enlace_invalido');
}
