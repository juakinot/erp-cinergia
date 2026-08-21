'use client';

import { useEffect, useRef, useState, useActionState } from 'react';
import { createCampaign, type ActionState } from './actions';

const inputClass =
  'rounded-md border border-[var(--border-mid)] px-2.5 py-1.5 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]';

const initialState: ActionState = { error: null };

export function CreateCampaignForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCampaign, initialState);
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
        + Nueva campaña
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="panel flex flex-col gap-3" style={{ maxWidth: 480 }}>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Título
        </label>
        <input name="title" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Descripción (opcional)
        </label>
        <textarea name="description" rows={2} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
            Apertura
          </label>
          <input name="opensAt" type="datetime-local" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
            Cierre (máx. 3 días después)
          </label>
          <input name="closesAt" type="datetime-local" required className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Umbral de votos para destacar
        </label>
        <input name="voteThreshold" type="number" min={1} defaultValue={5} className={inputClass} style={{ maxWidth: 100 }} />
      </div>

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn primary">
          {pending ? 'Creando…' : 'Crear campaña'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
