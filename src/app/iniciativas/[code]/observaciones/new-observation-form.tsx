'use client';

import { useEffect, useRef, useState, useActionState } from 'react';
import { createObservation, type ActionState } from './actions';

const inputClass =
  'rounded-md border border-[var(--border-mid)] px-2.5 py-1.5 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]';

const initialState: ActionState = { error: null };

export function NewObservationForm({ initiativeCode }: { initiativeCode: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createObservation, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error && formRef.current) {
      formRef.current.reset();
      setOpen(false);
    }
  }, [pending, state.error]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn primary" style={{ width: 'fit-content' }}>
        + Nueva observación
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="panel flex flex-col gap-3" style={{ maxWidth: 480 }}>
      <input type="hidden" name="initiativeCode" value={initiativeCode} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Observación
        </label>
        <textarea name="body" required rows={3} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Visibilidad
        </label>
        <select name="visibility" defaultValue="INTERNAL" className={inputClass}>
          <option value="INTERNAL">Todo el equipo</option>
          <option value="DIRECTION">Solo Dirección</option>
        </select>
        <p style={{ fontSize: 11, color: 'var(--text-2)' }}>
          &ldquo;Solo Dirección&rdquo; no es visible ni para ti después de publicarla — queda solo para Director de
          Área y Presidencia.
        </p>
      </div>

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn primary">
          {pending ? 'Publicando…' : 'Publicar'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
