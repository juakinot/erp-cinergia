'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { presidencySign, transitionActa } from '../iniciativas/[code]/acta/actions';

export function ActaApprovalActions({
  initiativeCode,
  actaId,
  needs,
}: {
  initiativeCode: string;
  actaId: string;
  needs: 'REVIEW' | 'SIGNATURE';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (!result.error) router.refresh();
    });
  }

  if (needs === 'SIGNATURE') {
    return (
      <div>
        <button
          type="button"
          disabled={pending}
          className="btn primary"
          onClick={() => run(() => presidencySign(initiativeCode, actaId))}
        >
          Firmar como Presidencia
        </button>
        {error && <p style={{ fontSize: 11, color: 'var(--alert-crit)', margin: '4px 0 0' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="actions">
        <button
          type="button"
          disabled={pending}
          className="btn primary"
          onClick={() => run(() => transitionActa(initiativeCode, actaId, 'APPROVED'))}
        >
          Aprobar
        </button>
        <button
          type="button"
          disabled={pending}
          className="btn danger"
          onClick={() => run(() => transitionActa(initiativeCode, actaId, 'DRAFT'))}
        >
          Devolver a borrador
        </button>
      </div>
      {error && <p style={{ fontSize: 11, color: 'var(--alert-crit)', margin: '4px 0 0' }}>{error}</p>}
    </div>
  );
}
