'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { activateCampaign, closeCampaign } from './actions';

export function CampaignLifecycleButton({
  campaignId,
  action,
}: {
  campaignId: string;
  action: 'activate' | 'close';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const label = action === 'activate' ? 'Activar campaña' : 'Cerrar campaña';
  const pendingLabel = action === 'activate' ? 'Activando…' : 'Cerrando…';

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={action === 'activate' ? 'btn primary' : 'btn danger'}
        style={{ width: 'fit-content' }}
        onClick={() =>
          startTransition(async () => {
            const fn = action === 'activate' ? activateCampaign : closeCampaign;
            const result = await fn(campaignId);
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
      >
        {pending ? pendingLabel : label}
      </button>
      {error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{error}</p>}
    </div>
  );
}
