'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { inviteUser, type ActionState } from '../actions';
import { ROLE_OPTIONS, AREA_SCOPED_ROLES } from '@/lib/roles';
import type { AppRole } from '@/lib/initiatives/types';

const initialState: ActionState = { error: null };

const inputClass =
  'rounded-md border border-[#D3DDEA] px-3 py-2 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';
const labelClass = 'text-sm font-medium text-[#003360]';

function CopyLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-md border border-[#BFE0C6] bg-[#E7F5EA] px-3 py-3 text-sm text-[#1F6B33]">
      <p className="font-medium">Cuenta creada. Copia este enlace y envíaselo a la persona:</p>
      <p className="mt-2 break-all rounded bg-white px-2 py-1.5 font-mono text-xs text-[#003360]">{link}</p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-2 rounded-md bg-[#1F6B33] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#175226]"
      >
        {copied ? 'Copiado ✓' : 'Copiar enlace'}
      </button>
      <p className="mt-2 text-xs text-[#1F6B33]/80">
        El enlace es de un solo uso y expira — si la persona tarda en usarlo, invítala de nuevo.
      </p>
    </div>
  );
}

export default function InviteUserForm({ areas }: { areas: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(inviteUser, initialState);
  const [role, setRole] = useState<AppRole>('MEMBER');
  const needsArea = AREA_SCOPED_ROLES.includes(role);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.inviteLink) {
      formRef.current?.reset();
      setRole('MEMBER');
    }
  }, [state.inviteLink]);

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
          Se crea la cuenta y un enlace de un solo uso para que la persona elija su propia
          contraseña. Tú se lo compartes por el canal que prefieras — nadie más que ella la conoce
          en ningún momento.
        </p>

        {state.inviteLink && (
          <div className="mb-5">
            <CopyLinkBox link={state.inviteLink} />
          </div>
        )}

        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-5 rounded-lg border border-[#E8EEF5] bg-white p-6"
        >
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
