'use client';

import { useEffect, useRef, useState, useTransition, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveInput,
  convertToLogisticsItem,
  convertToObservation,
  convertToRisk,
  convertToTask,
  rejectInput,
  triageInput,
  type ActionState,
} from './actions';
import { INPUT_KIND_LABELS, type InputKind } from '@/lib/radar/types';

const inputClass =
  'rounded-md border border-[#D3DDEA] px-2.5 py-1.5 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';

const initialState: ActionState = { error: null };

function TriageForm({ initiativeCode, inputId, kind }: { initiativeCode: string; inputId: string; kind: InputKind }) {
  const [state, formAction, pending] = useActionState(triageInput, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="initiativeCode" value={initiativeCode} />
      <input type="hidden" name="inputId" value={inputId} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Reclasificar tipo (opcional)
        </label>
        <select name="kind" defaultValue={kind} className={inputClass}>
          {Object.entries(INPUT_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Notas de prevalidación
        </label>
        <textarea name="notes" rows={2} className={inputClass} />
      </div>

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <button type="submit" disabled={pending} className="btn subtle" style={{ width: 'fit-content' }}>
        {pending ? 'Prevalidando…' : 'Prevalidar → en revisión'}
      </button>
    </form>
  );
}

function RejectForm({ initiativeCode, inputId }: { initiativeCode: string; inputId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(rejectInput, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error && formRef.current) formRef.current.reset();
  }, [pending, state.error]);

  if (!open) {
    return (
      <button type="button" className="btn danger" onClick={() => setOpen(true)}>
        Rechazar
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2" style={{ width: '100%' }}>
      <input type="hidden" name="initiativeCode" value={initiativeCode} />
      <input type="hidden" name="inputId" value={inputId} />
      <textarea name="reason" required rows={2} placeholder="Motivo del rechazo…" className={inputClass} />
      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn danger">
          {pending ? 'Rechazando…' : 'Confirmar rechazo'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function RiskForm({ initiativeCode, inputId }: { initiativeCode: string; inputId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(convertToRisk, initialState);

  if (!open) {
    return (
      <button type="button" className="btn ghost" onClick={() => setOpen(true)}>
        Convertir en riesgo
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2" style={{ width: '100%' }}>
      <input type="hidden" name="initiativeCode" value={initiativeCode} />
      <input type="hidden" name="inputId" value={inputId} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Probabilidad
        </label>
        <select name="likelihood" defaultValue="MEDIUM" className={inputClass}>
          <option value="LOW">Baja</option>
          <option value="MEDIUM">Media</option>
          <option value="HIGH">Alta</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Impacto
        </label>
        <select name="impact" defaultValue="MEDIUM" className={inputClass}>
          <option value="LOW">Bajo</option>
          <option value="MEDIUM">Medio</option>
          <option value="HIGH">Alto</option>
        </select>
      </div>
      <textarea name="mitigationPlan" rows={2} placeholder="Plan de mitigación (opcional)…" className={inputClass} />
      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn primary">
          Crear riesgo
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function InputActions({
  initiativeCode,
  inputId,
  kind,
  status,
  canApprove,
  isTriager,
  hasChecklist,
}: {
  initiativeCode: string;
  inputId: string;
  kind: InputKind;
  status: string;
  canApprove: boolean;
  isTriager: boolean;
  hasChecklist: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const actionable = status === 'PROPOSED' || status === 'IN_REVIEW' || status === 'APPROVED';
  if (!actionable) return null;

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="rd-actions">
      {status === 'PROPOSED' && isTriager && (
        <div style={{ width: '100%' }}>
          <TriageForm initiativeCode={initiativeCode} inputId={inputId} kind={kind} />
        </div>
      )}

      {canApprove && (
        <>
          {status !== 'APPROVED' && (
            <button
              type="button"
              disabled={pending}
              className="btn primary"
              onClick={() => run(() => approveInput(initiativeCode, inputId))}
            >
              Aprobar
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            className="btn ghost"
            onClick={() => run(() => convertToTask(initiativeCode, inputId))}
          >
            Convertir en tarea
          </button>
          <RiskForm initiativeCode={initiativeCode} inputId={inputId} />
          <button
            type="button"
            disabled={pending}
            className="btn ghost"
            onClick={() => run(() => convertToObservation(initiativeCode, inputId))}
          >
            Convertir en observación
          </button>
          {hasChecklist && (
            <button
              type="button"
              disabled={pending}
              className="btn ghost"
              onClick={() => run(() => convertToLogisticsItem(initiativeCode, inputId))}
            >
              Convertir en ítem logístico
            </button>
          )}
          <RejectForm initiativeCode={initiativeCode} inputId={inputId} />
        </>
      )}

      {error && <p style={{ fontSize: 12, color: 'var(--alert-crit)', width: '100%' }}>{error}</p>}
    </div>
  );
}
