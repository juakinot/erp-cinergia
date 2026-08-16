'use client';

import { useState, useTransition } from 'react';
import { cancelInitiative } from '../actions';

export function CancelButton({ initiativeId }: { initiativeId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[#F4D2D5] px-4 py-2 text-sm font-semibold text-[#B4232F] hover:bg-[#F4D2D5]"
      >
        Cancelar iniciativa
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#F4D2D5] bg-[#FDEEEF] p-3">
      <label htmlFor="cancel-reason" className="text-xs font-medium text-[#B4232F]">
        Razón de la cancelación (mínimo 20 caracteres)
      </label>
      <textarea
        id="cancel-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="rounded-md border border-[#D3DDEA] px-3 py-2 text-sm text-[#003360] outline-none focus:border-[#0066CC]"
      />
      {error && <p className="text-xs text-[#B4232F]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelInitiative(initiativeId, reason);
              if (result.error) setError(result.error);
            })
          }
          className="rounded-md bg-[#B4232F] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Cancelando…' : 'Confirmar cancelación'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-[#D3DDEA] px-4 py-1.5 text-sm text-[#5A6B82]"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
