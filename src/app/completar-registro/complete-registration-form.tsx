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
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-soft)] bg-[var(--surface-panel)] p-8 shadow-sm">
        <p className="font-mono text-xs tracking-[0.14em] text-[var(--text-2)] uppercase">CINERGIA · ERP</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--text-1)]">Bienvenido, {fullName}</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">
          Elige tu contraseña para terminar de configurar tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[var(--text-1)]">
              Nueva contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-md border border-[var(--border-mid)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
            <p className="text-xs text-[var(--text-2)]">Mínimo 10 caracteres, con mayúscula, número y símbolo.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm" className="text-sm font-medium text-[var(--text-1)]">
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="rounded-md border border-[var(--border-mid)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-[var(--alert-crit-soft)] px-3 py-2 text-sm text-[var(--alert-crit)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Guardar y entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
