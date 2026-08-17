'use client';

import { useActionState, useState } from 'react';
import { inviteUser, type ActionState } from '../actions';
import { ROLE_OPTIONS, AREA_SCOPED_ROLES } from '@/lib/roles';
import type { AppRole } from '@/lib/initiatives/types';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';

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

/**
 * Campos del formulario, separados en su propio componente para poder
 * "reiniciarlos" con `key` (ver abajo) en vez de un useEffect que llame
 * setState — evita la cascada de renders que React desaconseja y de paso
 * resetea tanto los campos no controlados como el `role` controlado en un
 * solo golpe declarativo.
 */
function InviteFields({
  formAction,
  pending,
  error,
  areas,
}: {
  formAction: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
  areas: Array<{ id: string; name: string }>;
}) {
  const [role, setRole] = useState<AppRole>('MEMBER');
  const needsArea = AREA_SCOPED_ROLES.includes(role);

  return (
    <form action={formAction} className="panel flex flex-col gap-5">
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
        <p className="text-xs text-[#5A6B82]">Este rol no está atado a una sola área — ve o abarca las 3.</p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-[#F4D2D5] px-3 py-2 text-sm text-[#B4232F]">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn primary">
        {pending ? 'Invitando…' : 'Enviar invitación'}
      </button>
    </form>
  );
}

export default function InviteUserForm({
  user,
  areas,
}: {
  user: { fullName: string; role: AppRole; area?: { name: string } | null };
  areas: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(inviteUser, initialState);

  return (
    <AppShell user={user} active="/usuarios">
      <Breadcrumb backHref="/usuarios" backLabel="Usuarios" />
      <div style={{ maxWidth: 460 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Invitar usuario</h1>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-2)' }}>
          Se crea la cuenta y un enlace de un solo uso para que la persona elija su propia contraseña. Tú se lo
          compartes por el canal que prefieras — nadie más que ella la conoce en ningún momento.
        </p>

        {state.inviteLink && (
          <div style={{ marginBottom: 20 }}>
            <CopyLinkBox link={state.inviteLink} />
          </div>
        )}

        {/* La key cambia cuando llega un enlace nuevo — React remonta el
            formulario entero (campos no controlados y `role` incluidos)
            en vez de necesitar un efecto que llame setState. */}
        <InviteFields
          key={state.inviteLink ?? 'idle'}
          formAction={formAction}
          pending={pending}
          error={state.error}
          areas={areas}
        />
      </div>
    </AppShell>
  );
}
