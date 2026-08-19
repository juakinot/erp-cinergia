'use client';

import { useEffect, useRef, useState, useTransition, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { replyObservation, toggleResolved, type ActionState } from './actions';
import type { ObservationRow } from '@/lib/observations/types';

const inputClass =
  'rounded-md border border-[#D3DDEA] px-2.5 py-1.5 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';

function authorName(field: ObservationRow['author']) {
  const a = Array.isArray(field) ? field[0] : field;
  return a?.full_name ?? '—';
}

const initialState: ActionState = { error: null };

function ReplyForm({ initiativeCode, parentId }: { initiativeCode: string; parentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(replyObservation, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error && formRef.current) {
      formRef.current.reset();
      setOpen(false);
    }
  }, [pending, state.error]);

  if (!open) {
    return (
      <button type="button" className="btn subtle" onClick={() => setOpen(true)}>
        Responder
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2" style={{ marginTop: 8 }}>
      <input type="hidden" name="initiativeCode" value={initiativeCode} />
      <input type="hidden" name="parentId" value={parentId} />
      <textarea name="body" required rows={2} className={inputClass} />
      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn primary">
          {pending ? 'Enviando…' : 'Responder'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ResolveToggle({
  initiativeCode,
  observationId,
  resolved,
}: {
  initiativeCode: string;
  observationId: string;
  resolved: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="btn subtle"
        onClick={() =>
          startTransition(async () => {
            const result = await toggleResolved(initiativeCode, observationId, !resolved);
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
      >
        {pending ? 'Guardando…' : resolved ? 'Reabrir' : 'Marcar resuelta'}
      </button>
      {error && <p style={{ fontSize: 11, color: 'var(--alert-crit)' }}>{error}</p>}
    </div>
  );
}

export function ObservationThread({
  initiativeCode,
  observation,
  replies,
  currentUserId,
  canModerate,
  visibilityLabel,
}: {
  initiativeCode: string;
  observation: ObservationRow;
  replies: ObservationRow[];
  currentUserId: string;
  canModerate: boolean;
  visibilityLabel: string;
}) {
  const canResolve = canModerate || observation.author_user_id === currentUserId;

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            {authorName(observation.author)}
          </p>
          <p style={{ margin: '4px 0 8px', fontSize: 13, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>
            {observation.body}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge b-neutral">{visibilityLabel}</span>
            <span className={`badge ${observation.resolved ? 'b-verde' : 'b-amarillo'}`}>
              {observation.resolved ? 'Resuelta' : 'Abierta'}
            </span>
          </div>
        </div>
        {canResolve && (
          <ResolveToggle initiativeCode={initiativeCode} observationId={observation.id} resolved={observation.resolved} />
        )}
      </div>

      {replies.length > 0 && (
        <div style={{ marginTop: 12, paddingLeft: 16, borderLeft: '2px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {replies.map((r) => (
            <div key={r.id}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{authorName(r.author)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>{r.body}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <ReplyForm initiativeCode={initiativeCode} parentId={observation.id} />
      </div>
    </div>
  );
}
