'use client';

import { useEffect, useRef, useState, useActionState } from 'react';
import { createProposal, type ActionState } from './actions';

const inputClass =
  'rounded-md border border-[var(--border-mid)] px-2.5 py-1.5 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]';

const initialState: ActionState = { error: null };

export function NewProposalForm({ areas }: { areas: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProposal, initialState);
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
        + Nueva propuesta
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="panel flex flex-col gap-3" style={{ maxWidth: 520 }}>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Título
        </label>
        <input name="title" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Justificación (qué tendencia o dato la motiva)
        </label>
        <textarea name="rationale" required rows={3} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Acción sugerida
        </label>
        <textarea name="suggestedAction" required rows={2} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Áreas afectadas
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {areas.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-1)' }}>
              <input type="checkbox" name="affectedAreaIds" value={a.id} />
              {a.name}
            </label>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-2)' }}>
          Si marcas solo una, decide el Director de esa área. Si marcas varias, decide Presidencia.
        </p>
      </div>

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn primary">
          {pending ? 'Enviando…' : 'Enviar propuesta'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
