'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCalendarItem } from './actions';

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="btn danger"
        onClick={() =>
          startTransition(async () => {
            const result = await deleteCalendarItem(itemId);
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
      >
        {pending ? 'Eliminando…' : 'Eliminar'}
      </button>
      {error && <p style={{ fontSize: 11, color: 'var(--alert-crit)' }}>{error}</p>}
    </div>
  );
}
