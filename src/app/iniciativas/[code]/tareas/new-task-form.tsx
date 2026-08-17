'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createTask, type ActionState } from './actions';
import { PRIORITY_LABELS, type TaskPriority } from '@/lib/tasks/types';

const initialState: ActionState = { error: null };

const inputClass =
  'rounded-md border border-[#D3DDEA] px-2.5 py-1.5 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';

export function NewTaskForm({
  initiativeCode,
  areaMembers,
}: {
  initiativeCode: string;
  areaMembers: Array<{ id: string; full_name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTask, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error && formRef.current) {
      formRef.current.reset();
      setOpen(false);
    }
  }, [pending, state.error]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0059B3]"
      >
        + Nueva tarea
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex w-full max-w-md flex-col gap-2.5 rounded-lg border border-[#E8EEF5] bg-white p-4"
    >
      <input type="hidden" name="initiativeCode" value={initiativeCode} />
      <input name="title" placeholder="Título de la tarea" required className={inputClass} />
      <textarea name="description" placeholder="Descripción (opcional)" rows={2} className={inputClass} />
      <div className="flex gap-2.5">
        <select name="priority" defaultValue="MEDIUM" className={`flex-1 ${inputClass}`}>
          {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <input type="date" name="dueDate" className={`flex-1 ${inputClass}`} />
      </div>
      <select name="assigneeUserId" defaultValue="" className={inputClass}>
        <option value="">Sin asignar</option>
        {areaMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name}
          </option>
        ))}
      </select>

      {state.error && <p className="text-xs text-[#B4232F]">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#0066CC] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0059B3] disabled:opacity-60"
        >
          {pending ? 'Creando…' : 'Crear tarea'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-[#D3DDEA] px-3 py-1.5 text-sm text-[#5A6B82]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
