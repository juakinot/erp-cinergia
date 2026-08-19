'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decideProposal } from './actions';
import type { ProposalStatus } from '@/lib/proposals/types';

const inputClass =
  'rounded-md border border-[#D3DDEA] px-2.5 py-1.5 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';

export function DecideProposalActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  function decide(status: ProposalStatus) {
    startTransition(async () => {
      const result = await decideProposal(proposalId, status, notes);
      setError(result.error);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-mid)' }}>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas de decisión (opcional)…"
        rows={2}
        className={inputClass}
        style={{ width: '100%', marginBottom: 8 }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={pending} className="btn primary" onClick={() => decide('APPROVED')}>
          Aprobar
        </button>
        <button type="button" disabled={pending} className="btn ghost" onClick={() => decide('CONVERTED')}>
          Marcar como convertida en acción
        </button>
        <button type="button" disabled={pending} className="btn danger" onClick={() => decide('REJECTED')}>
          Rechazar
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: 'var(--alert-crit)', marginTop: 6 }}>{error}</p>}
    </div>
  );
}
