'use server';

import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * La verificación real del token pasa por aquí — nunca por un GET simple —
 * precisamente porque un GET simple es indistinguible de la precarga de
 * enlaces de apps de mensajería (WhatsApp, Telegram, etc. piden la URL para
 * armar la tarjeta de vista previa apenas se envía el mensaje, antes de que
 * la persona haga clic). Eso gastaba el token de un solo uso sin que nadie
 * lo hubiera usado de verdad. Server Action solo se dispara con un POST que
 * viene de un clic real, así que un rastreador que solo hace GET nunca la
 * ejecuta. Ver D14 en decisiones-tecnicas.md.
 */
export async function confirmInvite(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '') || null;
  const type = (String(formData.get('type') ?? '') || null) as EmailOtpType | null;
  const code = String(formData.get('code') ?? '') || null;
  const next = String(formData.get('next') ?? '') || '/completar-registro';

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
