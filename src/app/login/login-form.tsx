'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const initialState: LoginState = { error: null };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-soft)] bg-[var(--surface-panel)] p-8 shadow-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs tracking-[0.14em] text-[var(--text-2)] uppercase">
            CINERGIA
          </p>
          <h1 className="mt-2 text-xl font-bold text-[var(--text-1)]">Iniciar sesión</h1>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[var(--text-1)]">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-md border border-[var(--border-mid)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[var(--text-1)]">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-md border border-[var(--border-mid)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          {state.error && (
            <p role="alert" className="rounded-md bg-[var(--alert-crit-soft)] px-3 py-2 text-sm text-[var(--alert-crit)]">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
          >
            {pending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
