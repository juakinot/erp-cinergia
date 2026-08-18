'use client';

import { useEffect, useRef, useState, useTransition, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { addItem, deleteItem, setItemStatus, type ActionState } from './actions';
import {
  ITEM_STATUS_LABELS,
  SUGGESTED_CATEGORIES,
  type LogisticsItemRow,
  type LogisticsItemStatus,
} from '@/lib/logistics/types';

const STATUS_BADGE: Record<LogisticsItemStatus, string> = {
  PENDING: 'b-neutral',
  DONE: 'b-verde',
  NOT_APPLICABLE: 'b-info',
};

const inputClass =
  'rounded-md border border-[#D3DDEA] px-2.5 py-1.5 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';

function ItemRow({
  item,
  initiativeCode,
  isManager,
}: {
  item: LogisticsItemRow;
  initiativeCode: string;
  isManager: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [naReason, setNaReason] = useState<string | null>(null);

  function move(status: LogisticsItemStatus, reason?: string) {
    startTransition(async () => {
      const result = await setItemStatus(initiativeCode, item.id, status, reason);
      setError(result.error);
      if (!result.error) {
        setNaReason(null);
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteItem(initiativeCode, item.id);
      setError(result.error);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{item.description}</p>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span className="badge b-neutral">{item.category}</span>
            {item.required && <span className="badge b-amarillo">Obligatorio</span>}
            {item.needs_evidence && <span className="badge b-neutral">Requiere evidencia</span>}
          </div>
          {item.status === 'NOT_APPLICABLE' && item.not_applicable_reason && (
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-2)' }}>
              No aplica: {item.not_applicable_reason}
            </p>
          )}
        </div>
        <span className={`badge ${STATUS_BADGE[item.status]}`}>{ITEM_STATUS_LABELS[item.status]}</span>
      </div>

      {isManager && naReason === null && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {item.status !== 'DONE' && (
            <button type="button" disabled={pending} className="btn subtle" onClick={() => move('DONE')}>
              Marcar hecho
            </button>
          )}
          {item.status === 'PENDING' && (
            <button type="button" disabled={pending} className="btn subtle" onClick={() => setNaReason('')}>
              No aplica
            </button>
          )}
          {item.status !== 'PENDING' && (
            <button type="button" disabled={pending} className="btn subtle" onClick={() => move('PENDING')}>
              Reabrir
            </button>
          )}
          <button type="button" disabled={pending} className="btn danger" onClick={remove}>
            Eliminar
          </button>
        </div>
      )}

      {isManager && naReason !== null && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            autoFocus
            value={naReason}
            onChange={(e) => setNaReason(e.target.value)}
            placeholder="Motivo por el que no aplica…"
            rows={2}
            className={inputClass}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={pending}
              className="btn primary"
              onClick={() => move('NOT_APPLICABLE', naReason)}
            >
              Confirmar
            </button>
            <button type="button" className="btn subtle" onClick={() => setNaReason(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--alert-crit)' }}>{error}</p>}
    </div>
  );
}

const initialState: ActionState = { error: null };

function NewItemForm({ initiativeCode, checklistId }: { initiativeCode: string; checklistId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addItem, initialState);
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
        + Agregar ítem
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="panel flex flex-col gap-3" style={{ maxWidth: 420 }}>
      <input type="hidden" name="initiativeCode" value={initiativeCode} />
      <input type="hidden" name="checklistId" value={checklistId} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Categoría
        </label>
        <input name="category" list="logistics-categories" required className={inputClass} />
        <datalist id="logistics-categories">
          {SUGGESTED_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Descripción
        </label>
        <textarea name="description" required rows={2} className={inputClass} />
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-1)' }}>
        <input type="checkbox" name="required" defaultChecked />
        Obligatorio para pasar a &quot;Listo para ejecución&quot;
      </label>
      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-1)' }}>
        <input type="checkbox" name="needsEvidence" />
        Requiere evidencia (adjuntos aún no implementados)
      </label>

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn primary">
          {pending ? 'Agregando…' : 'Agregar'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function ChecklistView({
  initiativeCode,
  checklistId,
  items,
  isManager,
}: {
  initiativeCode: string;
  checklistId: string;
  items: LogisticsItemRow[];
  isManager: boolean;
}) {
  const required = items.filter((i) => i.required);
  const requiredResolved = required.filter((i) => i.status !== 'PENDING').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className={`kpi ${required.length > 0 && requiredResolved < required.length ? 'warn' : 'ok'}`}>
          <div className="k-label">Obligatorios resueltos</div>
          <div className="k-value">
            {requiredResolved}/{required.length}
          </div>
        </div>
        <div className="kpi">
          <div className="k-label">Ítems totales</div>
          <div className="k-value">{items.length}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">Checklist vacío — agrega el primer ítem.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} initiativeCode={initiativeCode} isManager={isManager} />
          ))}
        </div>
      )}

      {isManager && <NewItemForm initiativeCode={initiativeCode} checklistId={checklistId} />}
    </div>
  );
}
