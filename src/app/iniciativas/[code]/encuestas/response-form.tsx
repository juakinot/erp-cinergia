'use client';

import { useRef, useState, useTransition } from 'react';
import { submitResponse, type ActionState } from './actions';
import type { SurveyQuestionRow, SurveyRow } from '@/lib/surveys/types';

const inputClass =
  'rounded-md border border-[var(--border-mid)] px-2.5 py-1.5 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]';

function QuestionInput({ question }: { question: SurveyQuestionRow }) {
  const name = `answer_${question.id}`;

  if (question.type === 'SCALE_1_5') {
    return (
      <div style={{ display: 'flex', gap: 16 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-1)' }}>
            <input type="radio" name={name} value={n} required={question.required} />
            {n}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'SINGLE_CHOICE') {
    return (
      <div className="flex flex-col gap-1.5">
        {(question.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-1)' }}>
            <input type="radio" name={name} value={opt} required={question.required} />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    return (
      <div className="flex flex-col gap-1.5">
        {(question.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-1)' }}>
            <input type="checkbox" name={name} value={opt} />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'NUMERIC') {
    return <input type="number" name={name} required={question.required} className={inputClass} style={{ maxWidth: 160 }} />;
  }

  return <textarea name={name} required={question.required} rows={2} className={inputClass} />;
}

const initialState: ActionState = { error: null };

export function ResponseForm({
  initiativeCode,
  survey,
  questions,
}: {
  initiativeCode: string;
  survey: SurveyRow;
  questions: SurveyQuestionRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(initialState);
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startTransition(async () => {
      const result = await submitResponse(initialState, formData);
      setState(result);
      if (!result.error) setSubmitted(true);
    });
  }

  if (submitted) {
    return <div className="panel">¡Gracias! Tu respuesta fue enviada.</div>;
  }

  if (questions.length === 0) {
    return <div className="empty">Esta encuesta todavía no tiene preguntas.</div>;
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="initiativeCode" value={initiativeCode} />
      <input type="hidden" name="surveyId" value={survey.id} />
      <input type="hidden" name="anonymous" value={survey.anonymous ? 'true' : 'false'} />

      {questions.map((q) => (
        <div key={q.id} className="panel" style={{ padding: 12 }}>
          <input type="hidden" name="questionId" value={q.id} />
          <input type="hidden" name="questionType" value={q.type} />
          <input type="hidden" name="questionRequired" value={q.required ? 'true' : 'false'} />
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
            {q.text} {q.required && <span style={{ color: 'var(--alert-crit)' }}>*</span>}
          </p>
          <QuestionInput question={q} />
        </div>
      ))}

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <button type="submit" disabled={pending} className="btn primary" style={{ width: 'fit-content' }}>
        {pending ? 'Enviando…' : 'Enviar respuesta'}
      </button>
    </form>
  );
}
