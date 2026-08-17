'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Misma política que D-Auth de la arquitectura: ≥10 caracteres, mayúscula, número y símbolo. */
function validatePassword(password: string): string | null {
  if (password.length < 10) return 'Debe tener al menos 10 caracteres.';
  if (!/[A-Z]/.test(password)) return 'Debe incluir al menos una mayúscula.';
  if (!/[0-9]/.test(password)) return 'Debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Debe incluir al menos un símbolo.';
  return null;
}

export default function CompleteRegistrationForm({ fullName }: { fullName: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
      <div className="w-full max-w-sm rounded-lg border border-[#E8EEF5] bg-white p-8 shadow-sm">
        <p className="font-mono text-xs tracking-[0.14em] text-[#5A6B82] uppercase">CINERGIA · ERP</p>
        <h1 className="mt-2 text-xl font-bold text-[#003360]">Bienvenido, {fullName}</h1>
        <p className="mt-1 text-sm text-[#5A6B82]">
          Elige tu contraseña para terminar de configurar tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[#003360]">
              Nueva contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-md border border-[#D3DDEA] px-3 py-2 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]"
            />
            <p className="text-xs text-[#5A6B82]">Mínimo 10 caracteres, con mayúscula, número y símbolo.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm" className="text-sm font-medium text-[#003360]">
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="rounded-md border border-[#D3DDEA] px-3 py-2 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-[#F4D2D5] px-3 py-2 text-sm text-[#B4232F]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0059B3] disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Guardar y entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
