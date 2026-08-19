'use client';

import { useEffect, useRef, useState, useActionState } from 'react';
import { createCalendarItem, type ActionState } from './actions';
import { KIND_LABELS } from '@/lib/calendar/types';

const inputClass =
  'rounded-md border border-[#D3DDEA] px-2.5 py-1.5 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';

const initialState: ActionState = { error: null };

export function NewCalendarItemForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCalendarItem, initialState);
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
        + Nuevo evento
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
            Inicio
          </label>
          <input name="startsAt" type="datetime-local" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
            Fin
          </label>
          <input name="endsAt" type="datetime-local" required className={inputClass} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-1)' }}>
        <input type="checkbox" name="allDay" />
        Todo el día
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Lugar (opcional)
        </label>
        <input name="location" className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Tipo
        </label>
        <select name="kind" defaultValue="MEETING" className={inputClass}>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Visibilidad
        </label>
        <select name="visibility" defaultValue="TEAM" className={inputClass}>
          <option value="TEAM">Todo el equipo</option>
          <option value="PUBLIC">Público</option>
        </select>
      </div>

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn primary">
          {pending ? 'Guardando…' : 'Agregar'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
