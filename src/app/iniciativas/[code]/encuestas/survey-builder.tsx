'use client';

import { useEffect, useRef, useState, useTransition, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { activateSurvey, addQuestion, deleteQuestion, type ActionState } from './actions';
import { CHOICE_TYPES, QUESTION_TYPE_LABELS, type QuestionType, type SurveyQuestionRow, type SurveyRow } from '@/lib/surveys/types';

const inputClass =
  'rounded-md border border-[#D3DDEA] px-2.5 py-1.5 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';

function QuestionRow({ question, initiativeCode }: { question: SurveyQuestionRow; initiativeCode: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    startTransition(async () => {
      const result = await deleteQuestion(initiativeCode, question.id);
      setError(result.error);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{question.text}</p>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span className="badge b-neutral">{QUESTION_TYPE_LABELS[question.type]}</span>
            {question.required && <span className="badge b-amarillo">Obligatoria</span>}
          </div>
          {question.options && question.options.length > 0 && (
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-2)' }}>Opciones: {question.options.join(', ')}</p>
          )}
        </div>
        <button type="button" disabled={pending} className="btn danger" onClick={remove}>
          Eliminar
        </button>
      </div>
      {error && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--alert-crit)' }}>{error}</p>}
    </div>
  );
}

const initialState: ActionState = { error: null };

function NewQuestionForm({ initiativeCode, surveyId }: { initiativeCode: string; surveyId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<QuestionType>('OPEN_TEXT');
  const [state, formAction, pending] = useActionState(addQuestion, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error && formRef.current) {
      formRef.current.reset();
      setType('OPEN_TEXT');
      setOpen(false);
    }
  }, [pending, state.error]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn primary" style={{ width: 'fit-content' }}>
        + Agregar pregunta
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="panel flex flex-col gap-3" style={{ maxWidth: 420 }}>
      <input type="hidden" name="initiativeCode" value={initiativeCode} />
      <input type="hidden" name="surveyId" value={surveyId} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Pregunta
        </label>
        <textarea name="text" required rows={2} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
          Tipo de respuesta
        </label>
        <select
          name="type"
          className={inputClass}
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
        >
          {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {CHOICE_TYPES.includes(type) && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
            Opciones (una por línea)
          </label>
          <textarea name="options" rows={3} className={inputClass} placeholder={'Muy bueno\nBueno\nRegular\nMalo'} />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-1)' }}>
        <input type="checkbox" name="required" defaultChecked />
        Obligatoria
      </label>

      {state.error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{state.error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={pending} className="btn primary">
          {pending ? 'Agregando…' : 'Agregar'}
        </button>
        <button type="button" className="btn subtle" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ActivateButton({ initiativeCode, surveyId, disabled }: { initiativeCode: string; surveyId: string; disabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending || disabled}
        className="btn primary"
        style={{ width: 'fit-content' }}
        onClick={() =>
          startTransition(async () => {
            const result = await activateSurvey(initiativeCode, surveyId);
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
      >
        {pending ? 'Activando…' : 'Activar encuesta'}
      </button>
      {error && <p style={{ fontSize: 12, color: 'var(--alert-crit)' }}>{error}</p>}
    </div>
  );
}

export function SurveyBuilder({
  initiativeCode,
  survey,
  questions,
}: {
  initiativeCode: string;
  survey: SurveyRow;
  questions: SurveyQuestionRow[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="panel">
        <div className="panel-head">
          <span>{survey.title}</span>
          <span className="badge b-neutral">Borrador</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
          {survey.description || 'Sin descripción.'} · {survey.anonymous ? 'Anónima' : 'Identificada'}
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="empty">Todavía no hay preguntas — agrega la primera.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {questions.map((q) => (
            <QuestionRow key={q.id} question={q} initiativeCode={initiativeCode} />
          ))}
        </div>
      )}

      <NewQuestionForm initiativeCode={initiativeCode} surveyId={survey.id} />
      <ActivateButton initiativeCode={initiativeCode} surveyId={survey.id} disabled={questions.length === 0} />
    </div>
  );
}
