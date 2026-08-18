import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { validateTransition } from '@/lib/initiatives/state-machine';
import { canManageInitiative } from '@/lib/initiatives/permissions';
import { STATUS_LABELS, TYPE_LABELS, type InitiativeRow, type InitiativeStatus } from '@/lib/initiatives/types';
import { approveInitiative, requestEscalation, advanceInitiative } from '../actions';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';
import { ActionButton } from './action-button';
import { CancelButton } from './cancel-button';

const RISK_BADGE: Record<string, string> = { GREEN: 'b-verde', AMBER: 'b-amarillo', RED: 'b-rojo' };
const RISK_LABEL: Record<string, string> = { GREEN: 'Verde', AMBER: 'Naranja', RED: 'Rojo' };

const STATE_ORDER: InitiativeStatus[] = [
  'PROPOSAL',
  'APPROVED',
  'PLANNING',
  'READY',
  'EXECUTION',
  'POST_EVENT',
  'CLOSED',
];

const NEXT_STATUS: Partial<Record<InitiativeStatus, InitiativeStatus>> = {
  APPROVED: 'PLANNING',
  PLANNING: 'READY',
  READY: 'EXECUTION',
  EXECUTION: 'POST_EVENT',
  POST_EVENT: 'CLOSED',
};

const MODALITY_LABELS: Record<string, string> = { IN_PERSON: 'Presencial', VIRTUAL: 'Virtual', HYBRID: 'Híbrida' };

export default async function InitiativeDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('*, areas(name), coordinator:coordinator_user_id(full_name)')
    .eq('code', code)
    .maybeSingle();

  if (!initiative) notFound();

  const row = initiative as unknown as InitiativeRow & {
    areas: { name: string } | null;
    coordinator: { full_name: string } | null;
  };

  const { data: transitions } = await supabase
    .from('initiative_transitions')
    .select('from_status, to_status, reason, created_at, actor:actor_user_id(full_name)')
    .eq('initiative_id', row.id)
    .order('created_at', { ascending: false });

  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  const canActOnArea = canManageInitiative(actor, row);
  const hasBoard = row.status !== 'IDEA' && row.status !== 'PROPOSAL' && row.status !== 'APPROVED';

  // Vista previa real de la próxima transición — el motor decide, no la UI.
  let preview: { ok: boolean; reason?: string } | null = null;
  let nextStatus: InitiativeStatus | null = null;
  if (row.status === 'PROPOSAL' && canActOnArea) {
    preview = await validateTransition(supabase, row, 'APPROVED', actor);
  } else if (NEXT_STATUS[row.status] && canActOnArea) {
    nextStatus = NEXT_STATUS[row.status]!;
    preview = await validateTransition(supabase, row, nextStatus, actor);
  }

  const canCancel = canActOnArea && row.status !== 'CLOSED' && row.status !== 'CANCELLED';

  return (
    <AppShell user={user} active="/iniciativas">
      <Breadcrumb
        backHref="/iniciativas"
        backLabel="Iniciativas"
        code={row.code}
        status={STATUS_LABELS[row.status]}
        statusVariant={row.status === 'CANCELLED' ? 'rojo' : row.status === 'CLOSED' ? 'neutral' : 'info'}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{row.title}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            {TYPE_LABELS[row.type]} · {row.areas?.name ?? '—'} · Coordina {row.coordinator?.full_name ?? '—'}
          </p>
          {hasBoard && (
            <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
              <Link href={`/iniciativas/${row.code}/tareas`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)' }}>
                Ver tablero de tareas →
              </Link>
              <Link href={`/iniciativas/${row.code}/acta`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)' }}>
                Ver acta →
              </Link>
              <Link href={`/iniciativas/${row.code}/radar`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)' }}>
                Ver radar operativo →
              </Link>
              {row.type === 'EVENT' && (
                <Link
                  href={`/iniciativas/${row.code}/logistica`}
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)' }}
                >
                  Ver checklist logístico →
                </Link>
              )}
              {row.type === 'EVENT' && (
                <Link
                  href={`/iniciativas/${row.code}/encuestas`}
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)' }}
                >
                  Ver encuesta →
                </Link>
              )}
            </div>
          )}
        </div>
        <span className={`badge ${RISK_BADGE[row.risk_level]}`}>{RISK_LABEL[row.risk_level]}</span>
      </div>

      {/* Diagrama de estado */}
      <div className="panel" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          {STATE_ORDER.map((s, i) => {
            const isCurrent = s === row.status;
            const isPast = STATE_ORDER.indexOf(row.status) > i && row.status !== 'CANCELLED';
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  className={isCurrent ? 'badge b-info' : isPast ? 'badge' : 'badge b-neutral'}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    background: isCurrent ? 'var(--brand-primary)' : isPast ? 'var(--brand-primary-soft)' : undefined,
                    color: isCurrent ? '#fff' : isPast ? 'var(--brand-primary)' : undefined,
                  }}
                >
                  {STATUS_LABELS[s]}
                </span>
                {i < STATE_ORDER.length - 1 && <span style={{ color: 'var(--border-mid)' }}>→</span>}
              </div>
            );
          })}
        </div>
        {row.status === 'CANCELLED' && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--alert-crit)' }}>Cancelada: {row.cancelled_reason}</p>
        )}
      </div>

      {/* Datos */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
              Descripción
            </dt>
            <dd style={{ margin: '2px 0 0', color: 'var(--text-1)' }}>{row.description}</dd>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
              Objetivo
            </dt>
            <dd style={{ margin: '2px 0 0', color: 'var(--text-1)' }}>{row.objective}</dd>
          </div>
          <div>
            <dt style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
              Modalidad
            </dt>
            <dd style={{ margin: '2px 0 0', color: 'var(--text-1)' }}>{MODALITY_LABELS[row.modality] ?? row.modality}</dd>
          </div>
          <div>
            <dt style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
              Fecha planificada
            </dt>
            <dd style={{ margin: '2px 0 0', color: 'var(--text-1)' }}>
              {row.planned_date
                ? // timeZone: 'UTC' es intencional — planned_date es una fecha de
                  // calendario, no un instante; sin esto, formatear en una zona
                  // horaria distinta a UTC puede mostrar el día anterior.
                  new Date(row.planned_date).toLocaleDateString('es-PE', { timeZone: 'UTC' })
                : 'Sin definir'}
            </dd>
          </div>
          {row.projected_budget && (
            <div>
              <dt style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                Presupuesto proyectado
              </dt>
              <dd style={{ margin: '2px 0 0', color: 'var(--text-1)' }}>S/ {Number(row.projected_budget).toFixed(2)}</dd>
            </div>
          )}
          {row.venue && (
            <div>
              <dt style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                Sede
              </dt>
              <dd style={{ margin: '2px 0 0', color: 'var(--text-1)' }}>{row.venue}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Acciones */}
      {canActOnArea && row.status !== 'CLOSED' && row.status !== 'CANCELLED' && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h2>Acciones</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 }}>
            {row.status === 'PROPOSAL' && preview?.ok && (
              <ActionButton label="Aprobar" pendingLabel="Aprobando…" action={approveInitiative.bind(null, row.id)} />
            )}
            {row.status === 'PROPOSAL' &&
              !preview?.ok &&
              user.role === 'AREA_DIRECTOR' &&
              !row.escalation_requested_at && (
                <ActionButton
                  label="Solicitar aprobación de Presidencia"
                  variant="ghost"
                  action={requestEscalation.bind(null, row.id)}
                />
              )}
            {nextStatus && preview?.ok && (
              <ActionButton
                label={`Avanzar a "${STATUS_LABELS[nextStatus]}"`}
                action={advanceInitiative.bind(null, row.id, nextStatus)}
              />
            )}
            {canCancel && <CancelButton initiativeId={row.id} />}
          </div>
          {preview && !preview.ok && (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--alert-warn)' }}>Bloqueado:</span> {preview.reason}
            </p>
          )}
          {row.escalation_requested_at && row.status === 'PROPOSAL' && (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-2)' }}>
              Escalación solicitada — esperando decisión de Presidencia.
            </p>
          )}
        </div>
      )}

      {/* Historial */}
      <div className="panel">
        <div className="panel-head">
          <h2>Historial</h2>
        </div>
        {!transitions || transitions.length === 0 ? (
          <p className="empty">Sin transiciones registradas todavía.</p>
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 0, padding: 0, listStyle: 'none' }}>
            {(
              transitions as unknown as Array<{
                from_status: string | null;
                to_status: string;
                reason: string | null;
                created_at: string;
                actor: { full_name: string } | { full_name: string }[] | null;
              }>
            ).map((t, i) => {
              const actorName = Array.isArray(t.actor) ? t.actor[0]?.full_name : t.actor?.full_name;
              return (
                <li key={i} style={{ borderLeft: '2px solid var(--brand-primary-soft)', paddingLeft: 12, fontSize: 13 }}>
                  <p style={{ margin: 0, color: 'var(--text-1)' }}>
                    {t.from_status ? `${STATUS_LABELS[t.from_status as InitiativeStatus]} → ` : ''}
                    <span style={{ fontWeight: 600 }}>{STATUS_LABELS[t.to_status as InitiativeStatus]}</span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-2)' }}>
                    {actorName ?? 'Sistema'} · {new Date(t.created_at).toLocaleString('es-PE')}
                  </p>
                  {t.reason && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-2)' }}>{t.reason}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
