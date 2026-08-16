import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { validateTransition } from '@/lib/initiatives/state-machine';
import { STATUS_LABELS, TYPE_LABELS, type InitiativeRow, type InitiativeStatus } from '@/lib/initiatives/types';
import { approveInitiative, requestEscalation, advanceInitiative } from '../actions';
import { ActionButton } from './action-button';
import { CancelButton } from './cancel-button';

const RISK_STYLES: Record<string, string> = {
  GREEN: 'bg-[#CFE7DC] text-[#2C7A5A]',
  AMBER: 'bg-[#FDE4C0] text-[#F29918]',
  RED: 'bg-[#F4D2D5] text-[#B4232F]',
};

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
  const canActOnArea = user.role === 'PRESIDENT' || (user.role === 'AREA_DIRECTOR' && user.areaId === row.area_id);

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
    <main className="flex min-h-screen flex-col bg-[#F4F7FB]">
      <header className="border-b border-[#E8EEF5] bg-white px-6 py-4">
        <Link href="/iniciativas" className="text-xs font-medium text-[#5A6B82] hover:text-[#003360]">
          ← Iniciativas
        </Link>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-mono text-xs font-semibold text-[#0066CC]">{row.code}</p>
            <h1 className="mt-1 text-xl font-bold text-[#003360]">{row.title}</h1>
            <p className="mt-1 text-sm text-[#5A6B82]">
              {TYPE_LABELS[row.type]} · {row.areas?.name ?? '—'} · Coordina {row.coordinator?.full_name ?? '—'}
            </p>
          </div>
          <span
            className={`inline-block rounded px-2 py-1 text-[10px] font-semibold tracking-wide uppercase ${RISK_STYLES[row.risk_level]}`}
          >
            {row.risk_level === 'GREEN' ? 'Verde' : row.risk_level === 'AMBER' ? 'Naranja' : 'Rojo'}
          </span>
        </div>

        {/* Diagrama de estado */}
        <div className="mb-6 overflow-x-auto rounded-lg border border-[#E8EEF5] bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs">
            {STATE_ORDER.map((s, i) => {
              const isCurrent = s === row.status;
              const isPast = STATE_ORDER.indexOf(row.status) > i && row.status !== 'CANCELLED';
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <span
                    className={`rounded px-2 py-1 font-mono whitespace-nowrap ${
                      isCurrent
                        ? 'bg-[#0066CC] font-semibold text-white'
                        : isPast
                          ? 'bg-[#CCE5FF] text-[#0066CC]'
                          : 'bg-[#F4F7FB] text-[#B6C2D2]'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </span>
                  {i < STATE_ORDER.length - 1 && <span className="text-[#D3DDEA]">→</span>}
                </div>
              );
            })}
          </div>
          {row.status === 'CANCELLED' && (
            <p className="mt-3 text-sm text-[#B4232F]">
              Cancelada: {row.cancelled_reason}
            </p>
          )}
        </div>

        {/* Datos */}
        <div className="mb-6 rounded-lg border border-[#E8EEF5] bg-white p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <dt className="font-mono text-[10px] tracking-[0.08em] text-[#B6C2D2] uppercase">Descripción</dt>
              <dd className="mt-0.5 text-[#003360]">{row.description}</dd>
            </div>
            <div className="col-span-2">
              <dt className="font-mono text-[10px] tracking-[0.08em] text-[#B6C2D2] uppercase">Objetivo</dt>
              <dd className="mt-0.5 text-[#003360]">{row.objective}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-[#B6C2D2] uppercase">Modalidad</dt>
              <dd className="mt-0.5 text-[#003360]">{MODALITY_LABELS[row.modality] ?? row.modality}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-[#B6C2D2] uppercase">Fecha planificada</dt>
              <dd className="mt-0.5 text-[#003360]">
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
                <dt className="font-mono text-[10px] tracking-[0.08em] text-[#B6C2D2] uppercase">
                  Presupuesto proyectado
                </dt>
                <dd className="mt-0.5 text-[#003360]">S/ {Number(row.projected_budget).toFixed(2)}</dd>
              </div>
            )}
            {row.venue && (
              <div>
                <dt className="font-mono text-[10px] tracking-[0.08em] text-[#B6C2D2] uppercase">Sede</dt>
                <dd className="mt-0.5 text-[#003360]">{row.venue}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Acciones */}
        {canActOnArea && row.status !== 'CLOSED' && row.status !== 'CANCELLED' && (
          <div className="mb-6 rounded-lg border border-[#E8EEF5] bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-[#003360]">Acciones</h2>
            <div className="flex flex-wrap items-start gap-3">
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
              <p className="mt-3 text-xs text-[#5A6B82]">
                <span className="font-semibold text-[#F29918]">Bloqueado:</span> {preview.reason}
              </p>
            )}
            {row.escalation_requested_at && row.status === 'PROPOSAL' && (
              <p className="mt-3 text-xs text-[#5A6B82]">
                Escalación solicitada — esperando decisión de Presidencia.
              </p>
            )}
          </div>
        )}

        {/* Historial */}
        <div className="rounded-lg border border-[#E8EEF5] bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-[#003360]">Historial</h2>
          {!transitions || transitions.length === 0 ? (
            <p className="text-sm text-[#5A6B82]">Sin transiciones registradas todavía.</p>
          ) : (
            <ul className="flex flex-col gap-3">
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
                  <li key={i} className="border-l-2 border-[#CCE5FF] pl-3 text-sm">
                    <p className="text-[#003360]">
                      {t.from_status ? `${STATUS_LABELS[t.from_status as InitiativeStatus]} → ` : ''}
                      <span className="font-semibold">{STATUS_LABELS[t.to_status as InitiativeStatus]}</span>
                    </p>
                    <p className="text-xs text-[#5A6B82]">
                      {actorName ?? 'Sistema'} · {new Date(t.created_at).toLocaleString('es-PE')}
                    </p>
                    {t.reason && <p className="mt-0.5 text-xs text-[#5A6B82]">{t.reason}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
