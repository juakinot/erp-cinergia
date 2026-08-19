'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveInput, rejectInput } from '../iniciativas/[code]/radar/actions';

export function RadarApprovalActions({ initiativeCode, inputId }: { initiativeCode: string; inputId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  function approve() {
    startTransition(async () => {
      const result = await approveInput(initiativeCode, inputId);
      setError(result.error);
      if (!result.error) router.refresh();
    });
  }

  function reject() {
    const formData = new FormData();
    formData.set('initiativeCode', initiativeCode);
    formData.set('inputId', inputId);
    formData.set('reason', reason);
    startTransition(async () => {
      const result = await rejectInput({ error: null }, formData);
      setError(result.error);
      if (!result.error) router.refresh();
    });
  }

  if (rejecting) {
    return (
      <div className="stack-sm" style={{ minWidth: 220 }}>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo del rechazo…"
          rows={2}
          style={{ fontFamily: 'inherit', fontSize: 12, padding: 6, borderRadius: 4, border: '1px solid var(--border-mid)' }}
        />
        {error && <p style={{ fontSize: 11, color: 'var(--alert-crit)', margin: 0 }}>{error}</p>}
        <div className="actions">
          <button type="button" disabled={pending} className="btn danger" onClick={reject}>
            Confirmar
          </button>
          <button type="button" className="btn subtle" onClick={() => setRejecting(false)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="actions">
        <button type="button" disabled={pending} className="btn primary" onClick={approve}>
          Aprobar
        </button>
        <button type="button" disabled={pending} className="btn danger" onClick={() => setRejecting(true)}>
          Rechazar
        </button>
      </div>
      {error && <p style={{ fontSize: 11, color: 'var(--alert-crit)', margin: '4px 0 0' }}>{error}</p>}
    </div>
  );
}
