'use client';

import { useState, useTransition } from 'react';
import type { ActionState } from '../actions';

const VARIANT_CLASS: Record<'primary' | 'ghost', string> = {
  primary: 'bg-[#0066CC] text-white hover:bg-[#0059B3]',
  ghost: 'border border-[#D3DDEA] text-[#003360] hover:bg-[#F4F7FB]',
};

/** Botón para una Server Action con un único argumento ya `bind`eado. */
export function ActionButton({
  label,
  pendingLabel,
  variant = 'primary',
  action,
}: {
  label: string;
  pendingLabel?: string;
  variant?: 'primary' | 'ghost';
  action: () => Promise<ActionState>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await action();
            setError(result.error);
          })
        }
        className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${VARIANT_CLASS[variant]}`}
      >
        {pending ? (pendingLabel ?? 'Procesando…') : label}
      </button>
      {error && <p className="text-xs text-[#B4232F]">{error}</p>}
    </div>
  );
}
