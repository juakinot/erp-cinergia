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
  DRAFT: 'bg-[#E8EEF5] text-[#5A6B82]',
  REVIEW: 'bg-[#FDE4C0] text-[#F29918]',
  APPROVED: 'bg-[#CFE7DC] text-[#2C7A5A]',
  PUBLISHED: 'bg-[#CCE5FF] text-[#0066CC]',
};

const inputClass =
  'w-full rounded-md border border-[#D3DDEA] px-2.5 py-1.5 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';

function isPairShaped(value: unknown): value is Array<[string, string]> {
  return Array.isArray(value) && value.every((v) => Array.isArray(v) && v.length === 2);
}

function ReadOnlyValue({ field, value }: { field: ActaField; value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return <p className="text-sm text-[#B6C2D2] italic">Sin llenar.</p>;
  }

  if (field.type === 'textList' && Array.isArray(value)) {
    return (
      <ul className="list-disc pl-5 text-sm text-[#003360]">
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
          <tr className="text-left text-[10px] tracking-[0.06em] text-[#B6C2D2] uppercase">
            <th className="pr-2 pb-1 font-medium">{c1}</th>
            <th className="pb-1 font-medium">{c2}</th>
          </tr>
        </thead>
        <tbody>
          {value.map((pair, i) => (
            <tr key={i} className="border-t border-[#E8EEF5]">
              <td className="py-1 pr-2 text-[#003360]">{pair[0]}</td>
              <td className="py-1 text-[#003360]">{pair[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (field.type === 'personList' && Array.isArray(value)) {
    return (
      <ul className="flex flex-col gap-0.5 text-sm text-[#003360]">
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
          <tr className="text-left text-[10px] tracking-[0.06em] text-[#B6C2D2] uppercase">
            <th className="pr-2 pb-1 font-medium">Descripción</th>
            <th className="pr-2 pb-1 font-medium">Prob.</th>
            <th className="pr-2 pb-1 font-medium">Impacto</th>
            <th className="pb-1 font-medium">Mitigación</th>
          </tr>
        </thead>
        <tbody>
          {(value as Array<{ description: string; probability: string; impact: string; mitigation: string }>).map(
            (r, i) => (
              <tr key={i} className="border-t border-[#E8EEF5] align-top">
                <td className="py-1 pr-2 text-[#003360]">{r.description}</td>
                <td className="py-1 pr-2 text-[#003360]">{r.probability}</td>
                <td className="py-1 pr-2 text-[#003360]">{r.impact}</td>
                <td className="py-1 text-[#003360]">{r.mitigation}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    );
  }

  return <p className="text-sm whitespace-pre-wrap text-[#003360]">{String(value)}</p>;
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
            className="rounded border border-[#D3DDEA] px-2 text-xs text-[#5A6B82]"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, ''])}
        className="w-fit text-xs font-semibold text-[#0066CC] hover:underline"
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
        <div className="flex gap-1.5 text-[10px] tracking-[0.06em] text-[#B6C2D2] uppercase">
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
            className="rounded border border-[#D3DDEA] px-2 text-xs text-[#5A6B82]"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, ['', '']])}
        className="w-fit text-xs font-semibold text-[#0066CC] hover:underline"
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
      ? 'bg-[#0066CC] text-white hover:bg-[#0059B3]'
      : 'border border-[#D3DDEA] text-[#003360] hover:bg-[#F4F7FB]';

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
      {error && <p className="text-xs text-[#B4232F]">{error}</p>}
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
      <div className="rounded-lg border border-[#E8EEF5] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#003360]">{template.name}</h2>
            <p className="text-xs text-[#5A6B82]">Versión {acta.version}</p>
          </div>
          <span className={`rounded px-2 py-1 text-[10px] font-semibold tracking-wide uppercase ${STATUS_STYLES[acta.status]}`}>
            {STATUS_LABELS[acta.status]}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs text-[#5A6B82]">
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
              className="rounded-md border border-[#D3DDEA] px-4 py-2 text-sm font-semibold text-[#003360] hover:bg-[#F4F7FB] disabled:opacity-60"
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
        {saveError && <p className="mt-2 text-xs text-[#B4232F]">{saveError}</p>}
      </div>

      {[...template.sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <div key={section.id} className="rounded-lg border border-[#E8EEF5] bg-white p-6">
            <h3 className="mb-1 text-sm font-semibold text-[#003360]">
              {section.order}. {section.title}
            </h3>
            {section.help && <p className="mb-3 text-xs text-[#5A6B82]">{section.help}</p>}
            <div className="flex flex-col gap-4">
              {section.fields.map((field) => (
                <div key={field.id}>
                  <label className="mb-1 block text-xs font-medium text-[#003360]">
                    {field.label}
                    {field.required && field.source.kind === 'manual' && <span className="text-[#B4232F]"> *</span>}
                  </label>
                  {field.help && <p className="mb-1 text-xs text-[#5A6B82]">{field.help}</p>}
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
