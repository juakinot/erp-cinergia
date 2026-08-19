'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markAllAsRead } from './actions';

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btn subtle"
      onClick={() =>
        startTransition(async () => {
          await markAllAsRead();
          router.refresh();
        })
      }
    >
      {pending ? 'Marcando…' : 'Marcar todas como leídas'}
    </button>
  );
}
