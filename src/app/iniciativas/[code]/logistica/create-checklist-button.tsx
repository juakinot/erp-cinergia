'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createChecklist } from './actions';

export function CreateChecklistButton({ initiativeCode }: { initiativeCode: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        className="btn primary"
        style={{ width: 'fit-content' }}
        onClick={() =>
          startTransition(async () => {
            const result = await createChecklist(initiativeCode);
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
      >
        {pending ? 'Creando…' : 'Crear checklist'}
      </button>
      {error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{error}</p>}
    </div>
  );
}
