import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  CONVERTED_TO_LABELS,
  INPUT_KIND_LABELS,
  INPUT_STATUS_LABELS,
  type InitiativeInputRow,
  type InputTransitionRow,
} from '@/lib/radar/types';
import { PRIORITY_LABELS, PRIORITY_STYLES } from '@/lib/tasks/types';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';
import { InputActions } from '../input-actions';

const STATUS_VARIANT: Record<string, 'verde' | 'amarillo' | 'rojo' | 'info' | 'neutral'> = {
  PROPOSED: 'neutral',
  IN_REVIEW: 'info',
  APPROVED: 'verde',
  REJECTED: 'rojo',
  CONVERTED: 'verde',
  CLOSED: 'neutral',
};

function personName(field: InitiativeInputRow['author']) {
  const p = Array.isArray(field) ? field[0] : field;
  return p?.full_name ?? '—';
}

export default async function RadarInputPage({ params }: { params: Promise<{ code: string; inputId: string }> }) {
  const { code, inputId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('id, code, area_id, coordinator_user_id')
    .eq('code', code)
    .maybeSingle();
  if (!initiative) notFound();

  const row = initiative as { id: string; code: string; area_id: string; coordinator_user_id: string };

  const { data: input } = await supabase
    .from('initiative_inputs')
    .select(
      'id, initiative_id, author_user_id, kind, title, description, priority, status, reviewed_by_user_id, reviewed_at, review_notes, duplicate_of_id, converted_to_type, converted_to_id, converted_by_user_id, converted_at, rejected_reason, created_at, author:author_user_id(full_name), reviewed_by:reviewed_by_user_id(full_name)'
    )
    .eq('id', inputId)
    .eq('initiative_id', row.id)
    .maybeSingle();
  if (!input) notFound();

  const inputRow = input as unknown as InitiativeInputRow;

  const { data: transitions } = await supabase
    .from('initiative_input_transitions')
    .select('id, input_id, from_status, to_status, actor_user_id, notes, created_at, actor:actor_user_id(full_name)')
    .eq('input_id', inputId)
    .order('created_at', { ascending: true });

  const { data: checklist } = await supabase
    .from('logistics_checklists')
    .select('id')
    .eq('initiative_id', row.id)
    .maybeSingle();

  // Espeja `canApproveInput` de ../actions.ts, no `canManageInitiative`: en
  // el Radar el Coordinador solo prevalida — aprobar y convertir es de
  // Dirección. La autoridad real la impone el Server Action; esto solo
  // evita mostrar botones que fallarían.
  const canApprove = user.role === 'PRESIDENT' || (user.role === 'AREA_DIRECTOR' && user.areaId === row.area_id);
  const isTriager = user.role === 'COORDINATOR' || user.role === 'AREA_DIRECTOR' || user.role === 'PRESIDENT';

  return (
    <AppShell user={user} active="/iniciativas">
      <Breadcrumb
        backHref={`/iniciativas/${row.code}/radar`}
        backLabel={`${row.code} · Radar operativo`}
        code={INPUT_KIND_LABELS[inputRow.kind]}
        status={INPUT_STATUS_LABELS[inputRow.status]}
        statusVariant={STATUS_VARIANT[inputRow.status]}
      />

      <div className="radar-detail">
        <div className="rd-main">
          <h3 style={{ margin: '0 0 8px' }}>{inputRow.title}</h3>
          <div className="cluster" style={{ marginBottom: 10 }}>
            <span className={`badge ${PRIORITY_STYLES[inputRow.priority]}`}>
              Prioridad {PRIORITY_LABELS[inputRow.priority].toLowerCase()}
            </span>
            <span className="badge b-info">{INPUT_KIND_LABELS[inputRow.kind]}</span>
            {inputRow.reviewed_at && (
              <span className="badge b-neutral">Prevalidado por {personName(inputRow.reviewed_by)}</span>
            )}
          </div>
          <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
            {inputRow.description}
          </p>

          {inputRow.status === 'REJECTED' && inputRow.rejected_reason && (
            <p className="small" style={{ color: 'var(--alert-crit)' }}>
              Motivo del rechazo: {inputRow.rejected_reason}
            </p>
          )}
          {inputRow.status === 'CONVERTED' && inputRow.converted_to_type && (
            <p className="small" style={{ color: 'var(--state-ok)' }}>
              Convertido en {CONVERTED_TO_LABELS[inputRow.converted_to_type]}.
            </p>
          )}
          {inputRow.review_notes && (
            <p className="small" style={{ color: 'var(--text-2)' }}>
              Notas de prevalidación: {inputRow.review_notes}
            </p>
          )}

          <InputActions
            initiativeCode={row.code}
            inputId={inputRow.id}
            kind={inputRow.kind}
            status={inputRow.status}
            canApprove={canApprove}
            isTriager={isTriager}
            hasChecklist={!!checklist}
          />
        </div>

        <div className="rd-side">
          <h5>Metadata</h5>
          <dl className="rd-meta-grid">
            <dt>ID</dt>
            <dd className="mono">{inputRow.id.slice(0, 8)}</dd>
            <dt>Autor</dt>
            <dd>{personName(inputRow.author)}</dd>
            {inputRow.reviewed_at && (
              <>
                <dt>Prevalidado por</dt>
                <dd>{personName(inputRow.reviewed_by)}</dd>
              </>
            )}
          </dl>

          <h5>Historial</h5>
          {!transitions || transitions.length === 0 ? (
            <div className="empty" style={{ padding: '14px 8px' }}>
              Sin transiciones todavía.
            </div>
          ) : (
            <ul className="rd-timeline">
              {(transitions as unknown as InputTransitionRow[]).map((t) => (
                <li key={t.id}>
                  <span />
                  <div>
                    <div>
                      {INPUT_STATUS_LABELS[t.to_status]} · {personName(t.actor)}
                    </div>
                    {t.notes && <div style={{ color: 'var(--text-2)' }}>{t.notes}</div>}
                    <span className="when">{new Date(t.created_at).toLocaleString('es-PE')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
