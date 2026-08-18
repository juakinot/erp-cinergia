'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { closeSurvey } from './actions';

export function CloseSurveyButton({ initiativeCode, surveyId }: { initiativeCode: string; surveyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        className="btn danger"
        style={{ width: 'fit-content' }}
        onClick={() =>
          startTransition(async () => {
            const result = await closeSurvey(initiativeCode, surveyId);
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
      >
        {pending ? 'Cerrando…' : 'Cerrar encuesta'}
      </button>
      {error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{error}</p>}
    </div>
  );
}
