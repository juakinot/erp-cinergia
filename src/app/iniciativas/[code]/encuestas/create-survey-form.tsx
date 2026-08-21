'use client';

import { useActionState } from 'react';
import { createSurvey, type ActionState } from './actions';

const inputClass =
  'rounded-md border border-[var(--border-mid)] px-2.5 py-1.5 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]';

const initialState: ActionState = { error: null };

export function CreateSurveyForm({ initiativeCode }: { initiativeCode: string }) {
  const [state, formAction, pending] = useActionState(createSurvey, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3" style={{ maxWidth: 420 }}>
      <input type="hidden" name="initiativeCode" value={initiativeCode} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Título
        </label>
        <input name="title" required className={inputClass} placeholder="Encuesta post-evento" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Descripción (opcional)
        </label>
        <textarea name="description" rows={2} className={inputClass} />
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-1)' }}>
        <input type="checkbox" name="anonymous" defaultChecked />
        Respuestas anónimas
      </label>

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <button type="submit" disabled={pending} className="btn primary" style={{ width: 'fit-content' }}>
        {pending ? 'Creando…' : 'Crear encuesta'}
      </button>
    </form>
  );
}
