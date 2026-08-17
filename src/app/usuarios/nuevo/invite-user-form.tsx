'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { inviteUser, type ActionState } from '../actions';
import { ROLE_OPTIONS, AREA_SCOPED_ROLES } from '@/lib/roles';
import type { AppRole } from '@/lib/initiatives/types';

const initialState: ActionState = { error: null };

const inputClass =
  'rounded-md border border-[#D3DDEA] px-3 py-2 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';
const labelClass = 'text-sm font-medium text-[#003360]';

export default function InviteUserForm({ areas }: { areas: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(inviteUser, initialState);
  const [role, setRole] = useState<AppRole>('MEMBER');
  const needsArea = AREA_SCOPED_ROLES.includes(role);

  return (
    <main className="flex min-h-screen flex-col bg-[#F4F7FB]">
      <header className="border-b border-[#E8EEF5] bg-white px-6 py-4">
        <Link href="/usuarios" className="text-xs font-medium text-[#5A6B82] hover:text-[#003360]">
          ← Usuarios
        </Link>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-6 py-8">
        <h1 className="mb-2 text-lg font-bold text-[#003360]">Invitar usuario</h1>
        <p className="mb-6 text-sm text-[#5A6B82]">
          Le llega un correo real con un enlace para que elija su propia contraseña. Nadie más que
          esa persona la conoce en ningún momento.
        </p>

        <form action={formAction} className="flex flex-col gap-5 rounded-lg border border-[#E8EEF5] bg-white p-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fullName" className={labelClass}>
              Nombre completo
            </label>
            <input id="fullName" name="fullName" required className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={labelClass}>
              Correo
            </label>
            <input id="email" name="email" type="email" required className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className={labelClass}>
              Rol
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className={inputClass}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {needsArea && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="areaId" className={labelClass}>
                Área
              </label>
              <select id="areaId" name="areaId" required={needsArea} className={inputClass}>
                <option value="">Selecciona…</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!needsArea && (
            <p className="text-xs text-[#5A6B82]">
              Este rol no está atado a una sola área — ve o abarca las 3.
            </p>
          )}

          {state.error && (
            <p role="alert" className="rounded-md bg-[#F4D2D5] px-3 py-2 text-sm text-[#B4232F]">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0059B3] disabled:opacity-60"
          >
            {pending ? 'Invitando…' : 'Enviar invitación'}
          </button>
        </form>
      </div>
    </main>
  );
}
