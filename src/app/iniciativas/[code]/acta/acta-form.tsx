'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveActaDraft, transitionActa, presidencySign } from './actions';
import type { ActaTemplateDefinition, ActaField } from '@/lib/actas/types';
import type { ActaStatus } from '@/lib/actas/state-machine';
import type { AppRole } from '@/lib/initiatives/types';

interface ActaData {
  id: string;
  status: ActaStatus;
  input_data: Record<string, unknown>;
  version: number;
  reviewed_at: string | null;
  reviewer: { full_name: string } | null;
  approved_at: string | null;
  approver: { full_name: string } | null;
  presidency_approved_at: string | null;
  presidency_approver: { full_name: string } | null;
  published_at: string | null;
}

const STATUS_LABELS: Record<ActaStatus, string> = {
  DRAFT: 'Borrador',
  REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
  PUBLISHED: 'Publicada',
};

const STATUS_STYLES: Record<ActaStatus, string> = {
  DRAFT: 'bg-[var(--border-soft)] text-[var(--text-2)]',
  REVIEW: 'bg-[var(--alert-warn-soft)] text-[var(--alert-warn)]',
  APPROVED: 'bg-[var(--state-ok-soft)] text-[var(--state-ok)]',
  PUBLISHED: 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]',
};

const inputClass =
  'w-full rounded-md border border-[var(--border-mid)] px-2.5 py-1.5 text-sm text-[var(--text-1)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]';

function isPairShaped(value: unknown): value is Array<[string, string]> {
  return Array.isArray(value) && value.every((v) => Array.isArray(v) && v.length === 2);
}

function ReadOnlyValue({ field, value }: { field: ActaField; value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return <p className="text-sm text-[var(--text-3)] italic">Sin llenar.</p>;
  }

  if (field.type === 'textList' && Array.isArray(value)) {
    return (
      <ul className="list-disc pl-5 text-sm text-[var(--text-1)]">
        {value.map((v, i) => (
          <li key={i}>{String(v)}</li>
        ))}
      </ul>
    );
  }

  if ((field.type === 'pairList' || field.type === 'objectiveList' || field.type === 'metricList') && isPairShaped(value)) {
    const [c1, c2] = field.columns ?? ['', ''];
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.06em] text-[var(--text-3)] uppercase">
            <th className="pr-2 pb-1 font-medium">{c1}</th>
            <th className="pb-1 font-medium">{c2}</th>
          </tr>
        </thead>
        <tbody>
          {value.map((pair, i) => (
            <tr key={i} className="border-t border-[var(--border-soft)]">
              <td className="py-1 pr-2 text-[var(--text-1)]">{pair[0]}</td>
              <td className="py-1 text-[var(--text-1)]">{pair[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (field.type === 'personList' && Array.isArray(value)) {
    return (
      <ul className="flex flex-col gap-0.5 text-sm text-[var(--text-1)]">
        {(value as Array<{ name: string; role: string; isLeader: boolean }>).map((p, i) => (
          <li key={i}>
            {p.name} — {p.role}
            {p.isLeader ? ' (líder)' : ''}
          </li>
        ))}
      </ul>
    );
  }

  if (field.type === 'riskTable' && Array.isArray(value)) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.06em] text-[var(--text-3)] uppercase">
            <th className="pr-2 pb-1 font-medium">Descripción</th>
            <th className="pr-2 pb-1 font-medium">Prob.</th>
            <th className="pr-2 pb-1 font-medium">Impacto</th>
            <th className="pb-1 font-medium">Mitigación</th>
          </tr>
        </thead>
        <tbody>
          {(value as Array<{ description: string; probability: string; impact: string; mitigation: string }>).map(
            (r, i) => (
              <tr key={i} className="border-t border-[var(--border-soft)] align-top">
                <td className="py-1 pr-2 text-[var(--text-1)]">{r.description}</td>
                <td className="py-1 pr-2 text-[var(--text-1)]">{r.probability}</td>
                <td className="py-1 pr-2 text-[var(--text-1)]">{r.impact}</td>
                <td className="py-1 text-[var(--text-1)]">{r.mitigation}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    );
  }

  return <p className="text-sm whitespace-pre-wrap text-[var(--text-1)]">{String(value)}</p>;
}

function TextListEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {value.map((line, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            value={line}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded border border-[var(--border-mid)] px-2 text-xs text-[var(--text-2)]"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, ''])}
        className="w-fit text-xs font-semibold text-[var(--brand-primary)] hover:underline"
      >
        + Agregar línea
      </button>
    </div>
  );
}

function TwoColumnListEditor({
  value,
  onChange,
  columns,
}: {
  value: Array<[string, string]>;
  onChange: (v: Array<[string, string]>) => void;
  columns?: readonly [string, string];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {(columns ?? ['', '']).some(Boolean) && (
        <div className="flex gap-1.5 text-[10px] tracking-[0.06em] text-[var(--text-3)] uppercase">
          <span className="flex-1">{columns?.[0]}</span>
          <span className="flex-1">{columns?.[1]}</span>
          <span className="w-6" />
        </div>
      )}
      {value.map((pair, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            value={pair[0]}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? [e.target.value, v[1]] : v) as [string, string]))}
            className={`flex-1 ${inputClass}`}
          />
          <input
            value={pair[1]}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? [v[0], e.target.value] : v) as [string, string]))}
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded border border-[var(--border-mid)] px-2 text-xs text-[var(--text-2)]"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, ['', '']])}
        className="w-fit text-xs font-semibold text-[var(--brand-primary)] hover:underline"
      >
        + Agregar fila
      </button>
    </div>
  );
}

function ManualFieldEditor({
  field,
  value,
  onChange,
}: {
  field: ActaField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'longText':
      return (
        <textarea rows={4} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      );
    case 'number':
      return (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={inputClass}
        />
      );
    case 'date':
      return <input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
    case 'dateTime':
      return (
        <input
          type="datetime-local"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case 'select':
      return (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Selecciona…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case 'textList':
      return <TextListEditor value={(value as string[]) ?? []} onChange={onChange} />;
    case 'pairList':
    case 'objectiveList':
    case 'metricList':
      return (
        <TwoColumnListEditor value={(value as Array<[string, string]>) ?? []} onChange={onChange} columns={field.columns} />
      );
    default:
      return <input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  }
}

function ActionButton({
  label,
  onRun,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onRun: () => Promise<{ error: string | null }>;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const classes =
    variant === 'primary'
      ? 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]'
      : 'border border-[var(--border-mid)] text-[var(--text-1)] hover:bg-[var(--surface-page)]';

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() =>
          startTransition(async () => {
            const result = await onRun();
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
        className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${classes}`}
      >
        {pending ? 'Procesando…' : label}
      </button>
      {error && <p className="text-xs text-[var(--alert-crit)]">{error}</p>}
    </div>
  );
}

export function ActaForm({
  initiativeCode,
  template,
  acta,
  isManager,
  actorRole,
  missingCount,
}: {
  initiativeCode: string;
  template: ActaTemplateDefinition;
  acta: ActaData;
  isManager: boolean;
  actorRole: AppRole;
  missingCount: number;
}) {
  const router = useRouter();
  const [pendingSave, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const manualFieldIds = new Set(
    template.sections.flatMap((s) => s.fields).filter((f) => f.source.kind === 'manual').map((f) => f.id)
  );
  const [manualValues, setManualValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const id of manualFieldIds) initial[id] = acta.input_data[id];
    return initial;
  });

  const canEdit = acta.status === 'DRAFT' && isManager;
  const canDecide = acta.status === 'REVIEW' && (actorRole === 'PRESIDENT' || actorRole === 'AREA_DIRECTOR');
  const canSignPresidency =
    acta.status === 'APPROVED' &&
    template.requiresPresidencySignature &&
    !acta.presidency_approved_at &&
    actorRole === 'PRESIDENT';
  const canPublish = acta.status === 'APPROVED' && isManager;
  const publishBlocked = template.requiresPresidencySignature && !acta.presidency_approved_at;

  function saveDraft() {
    startSave(async () => {
      const result = await saveActaDraft(initiativeCode, acta.id, manualValues);
      setSaveError(result.error);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-panel)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-1)]">{template.name}</h2>
            <p className="text-xs text-[var(--text-2)]">Versión {acta.version}</p>
          </div>
          <span className={`rounded px-2 py-1 text-[10px] font-semibold tracking-wide uppercase ${STATUS_STYLES[acta.status]}`}>
            {STATUS_LABELS[acta.status]}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs text-[var(--text-2)]">
          {acta.reviewed_at && (
            <div>
              <dt className="font-mono uppercase">Revisado</dt>
              <dd>
                {acta.reviewer?.full_name ?? '—'} · {new Date(acta.reviewed_at).toLocaleDateString('es-PE')}
              </dd>
            </div>
          )}
          {acta.approved_at && (
            <div>
              <dt className="font-mono uppercase">Aprobado</dt>
              <dd>
                {acta.approver?.full_name ?? '—'} · {new Date(acta.approved_at).toLocaleDateString('es-PE')}
              </dd>
            </div>
          )}
          {template.requiresPresidencySignature && (
            <div>
              <dt className="font-mono uppercase">Firma de Presidencia</dt>
              <dd>
                {acta.presidency_approved_at
                  ? `${acta.presidency_approver?.full_name ?? '—'} · ${new Date(acta.presidency_approved_at).toLocaleDateString('es-PE')}`
                  : 'Pendiente'}
              </dd>
            </div>
          )}
          {acta.published_at && (
            <div>
              <dt className="font-mono uppercase">Publicado</dt>
              <dd>{new Date(acta.published_at).toLocaleDateString('es-PE')}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex flex-wrap gap-3">
          {canEdit && (
            <button
              type="button"
              disabled={pendingSave}
              onClick={saveDraft}
              className="rounded-md border border-[var(--border-mid)] px-4 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-page)] disabled:opacity-60"
            >
              {pendingSave ? 'Guardando…' : 'Guardar borrador'}
            </button>
          )}
          {canEdit && (
            <ActionButton
              label={missingCount > 0 ? `Enviar a revisión (faltan ${missingCount})` : 'Enviar a revisión'}
              onRun={() => transitionActa(initiativeCode, acta.id, 'REVIEW')}
              disabled={missingCount > 0}
            />
          )}
          {canDecide && (
            <>
              <ActionButton label="Aprobar" onRun={() => transitionActa(initiativeCode, acta.id, 'APPROVED')} />
              <ActionButton
                label="Devolver a borrador"
                variant="ghost"
                onRun={() => transitionActa(initiativeCode, acta.id, 'DRAFT')}
              />
            </>
          )}
          {canSignPresidency && (
            <ActionButton label="Firmar (Presidencia)" onRun={() => presidencySign(initiativeCode, acta.id)} />
          )}
          {canPublish && (
            <ActionButton
              label={publishBlocked ? 'Publicar (falta firma de Presidencia)' : 'Publicar'}
              onRun={() => transitionActa(initiativeCode, acta.id, 'PUBLISHED')}
              disabled={publishBlocked}
            />
          )}
        </div>
        {saveError && <p className="mt-2 text-xs text-[var(--alert-crit)]">{saveError}</p>}
      </div>

      {[...template.sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <div key={section.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-panel)] p-6">
            <h3 className="mb-1 text-sm font-semibold text-[var(--text-1)]">
              {section.order}. {section.title}
            </h3>
            {section.help && <p className="mb-3 text-xs text-[var(--text-2)]">{section.help}</p>}
            <div className="flex flex-col gap-4">
              {section.fields.map((field) => (
                <div key={field.id}>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-1)]">
                    {field.label}
                    {field.required && field.source.kind === 'manual' && <span className="text-[var(--alert-crit)]"> *</span>}
                  </label>
                  {field.help && <p className="mb-1 text-xs text-[var(--text-2)]">{field.help}</p>}
                  {canEdit && field.source.kind === 'manual' ? (
                    <ManualFieldEditor
                      field={field}
                      value={manualValues[field.id]}
                      onChange={(v) => setManualValues((prev) => ({ ...prev, [field.id]: v }))}
                    />
                  ) : (
                    <ReadOnlyValue field={field} value={acta.input_data[field.id]} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
