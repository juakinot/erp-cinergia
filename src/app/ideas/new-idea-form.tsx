'use client';

import { useEffect, useRef, useState, useActionState } from 'react';
import { createIdea, type ActionState } from './actions';

const inputClass =
  'rounded-md border border-[var(--border-mid)] px-2.5 py-1.5 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]';

const initialState: ActionState = { error: null };

export function NewIdeaForm({ campaignId, areas }: { campaignId: string; areas: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createIdea, initialState);
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
        + Proponer idea
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="panel flex flex-col gap-3" style={{ maxWidth: 480 }}>
      <input type="hidden" name="campaignId" value={campaignId} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Área
        </label>
        <select name="areaId" required className={inputClass}>
          <option value="">Selecciona…</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Título
        </label>
        <input name="title" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Descripción
        </label>
        <textarea name="description" required rows={3} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Objetivo
        </label>
        <textarea name="objective" required rows={2} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Modalidad
        </label>
        <select name="modality" defaultValue="IN_PERSON" className={inputClass}>
          <option value="IN_PERSON">Presencial</option>
          <option value="VIRTUAL">Virtual</option>
          <option value="HYBRID">Híbrida</option>
        </select>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-2)' }}>
        Se guarda como borrador — solo tú la ves hasta que la publiques.
      </p>

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn primary">
          {pending ? 'Guardando…' : 'Guardar borrador'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
