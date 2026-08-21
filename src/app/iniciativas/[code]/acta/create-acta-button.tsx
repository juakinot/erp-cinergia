'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createActa } from './actions';

export function CreateActaButton({ initiativeCode }: { initiativeCode: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await createActa(initiativeCode);
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
        className="w-fit rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
      >
        {pending ? 'Creando…' : 'Crear acta'}
      </button>
      {error && <p className="text-xs text-[var(--alert-crit)]">{error}</p>}
    </div>
  );
}
