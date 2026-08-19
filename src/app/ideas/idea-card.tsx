'use client';

import { useState, useTransition, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { discardIdea, promoteIdea, publishIdea, toggleVote, type ActionState } from './actions';
import { IDEA_STATUS_BADGE, IDEA_STATUS_LABELS, type IdeaRow } from '@/lib/ideas/types';

const inputClass =
  'rounded-md border border-[#D3DDEA] px-2.5 py-1.5 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';

function personName(field: IdeaRow['author']) {
  const p = Array.isArray(field) ? field[0] : field;
  return p?.full_name ?? '—';
}
function areaName(field: IdeaRow['areas']) {
  const a = Array.isArray(field) ? field[0] : field;
  return a?.name ?? '—';
}

const initialState: ActionState = { error: null };

function DiscardForm({ ideaId }: { ideaId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(discardIdea, initialState);

  if (!open) {
    return (
      <button type="button" className="btn danger" onClick={() => setOpen(true)}>
        Descartar
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2" style={{ width: '100%' }}>
      <input type="hidden" name="ideaId" value={ideaId} />
      <textarea name="reason" required rows={2} placeholder="Motivo del descarte…" className={inputClass} />
      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn danger">
          {pending ? 'Descartando…' : 'Confirmar'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function IdeaCard({
  idea,
  currentUserId,
  userRole,
  userAreaId,
  voteThreshold,
}: {
  idea: IdeaRow;
  currentUserId: string;
  userRole: string;
  userAreaId: string | null;
  voteThreshold: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isAuthor = idea.author_user_id === currentUserId;
  const canDecide = userRole === 'PRESIDENT' || (userRole === 'AREA_DIRECTOR' && userAreaId === idea.area_id);
  const meetsThreshold = (idea.vote_count ?? 0) >= voteThreshold;

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{idea.title}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
            {areaName(idea.areas)} · {personName(idea.author)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {idea.status === 'ACTIVE' && (
            <span className={`badge ${meetsThreshold ? 'b-verde' : 'b-neutral'}`}>{idea.vote_count ?? 0} votos</span>
          )}
          <span className={`badge ${IDEA_STATUS_BADGE[idea.status]}`}>{IDEA_STATUS_LABELS[idea.status]}</span>
        </div>
      </div>

      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-1)' }}>{idea.description}</p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
        <strong>Objetivo:</strong> {idea.objective}
      </p>
      {idea.status === 'DISCARDED' && idea.discarded_reason && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--alert-crit)' }}>
          Motivo: {idea.discarded_reason}
        </p>
      )}

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {idea.status === 'DRAFT' && isAuthor && (
          <button type="button" disabled={pending} className="btn primary" onClick={() => run(() => publishIdea(idea.id))}>
            Publicar
          </button>
        )}

        {idea.status === 'ACTIVE' && !isAuthor && (
          <button
            type="button"
            disabled={pending}
            className={idea.voted_by_me ? 'btn subtle' : 'btn ghost'}
            onClick={() => run(() => toggleVote(idea.id, Boolean(idea.voted_by_me)))}
          >
            {idea.voted_by_me ? 'Quitar voto' : 'Votar'}
          </button>
        )}

        {idea.status === 'ACTIVE' && canDecide && (
          <>
            <button type="button" disabled={pending} className="btn primary" onClick={() => run(() => promoteIdea(idea.id))}>
              Promover a iniciativa
            </button>
            <DiscardForm ideaId={idea.id} />
          </>
        )}
      </div>

      {error && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--alert-crit)' }}>{error}</p>}
    </div>
  );
}
