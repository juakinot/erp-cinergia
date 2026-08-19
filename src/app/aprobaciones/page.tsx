import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getPendingApprovals, pendingCount } from '@/lib/approvals/queries';
import { INPUT_KIND_LABELS } from '@/lib/radar/types';
import { PRIORITY_LABELS, PRIORITY_STYLES } from '@/lib/tasks/types';
import { AppShell } from '@/components/app-shell';
import { InitiativeApprovalActions } from './initiative-approval-actions';
import { ActaApprovalActions } from './acta-approval-actions';
import { RadarApprovalActions } from './radar-approval-actions';

const TYPE_LABELS: Record<string, string> = { EVENT: 'Evento', CAMPAIGN: 'Campaña', PROJECT: 'Proyecto' };

export default async function ApprovalsPage() {
  const user = await requireUser();
  if (user.role !== 'PRESIDENT' && user.role !== 'AREA_DIRECTOR') redirect('/');

  const supabase = await createClient();

  const pending = await getPendingApprovals(supabase, { id: user.id, role: user.role, areaId: user.areaId });
  const total = pendingCount(pending);
  const isPresident = user.role === 'PRESIDENT';

  return (
    <AppShell user={user} active="/aprobaciones">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Aprobaciones</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            {isPresident
              ? 'Solo lo que requiere tu decisión: iniciativas escaladas, actas que exigen tu firma y Radar sin atender.'
              : 'Lo que corresponde decidir dentro de tu autoridad de área.'}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="empty">Nada pendiente por ahora.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.initiatives.length > 0 && (
            <div className="panel priority">
              <div className="panel-head">
                <h5>Iniciativas pendientes de aprobar</h5>
                <span className="badge b-rojo">{pending.initiatives.length}</span>
              </div>
              <div className="list-items">
                {pending.initiatives.map((i) => (
                  <div key={i.id} className="list-item urgent">
                    <div>
                      <Link href={`/iniciativas/${i.code}`} style={{ color: 'var(--text-1)', fontWeight: 600, textDecoration: 'none' }}>
                        {i.code} — {i.title}
                      </Link>
                      <span className="meta">
                        {TYPE_LABELS[i.type]} · {i.area_name}
                        {i.projected_budget && ` · S/ ${Number(i.projected_budget).toFixed(2)}`}
                        {i.escalation_requested_at && ' · Escalado por el Director'}
                      </span>
                    </div>
                    <InitiativeApprovalActions initiativeId={i.id} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.actas.length > 0 && (
            <div className="panel priority">
              <div className="panel-head">
                <h5>{isPresident ? 'Actas esperando firma de Presidencia' : 'Actas pendientes de revisión'}</h5>
                <span className="badge b-rojo">{pending.actas.length}</span>
              </div>
              <div className="list-items">
                {pending.actas.map((a) => (
                  <div key={a.id} className="list-item urgent">
                    <div>
                      <Link
                        href={`/iniciativas/${a.initiative_code}/acta`}
                        style={{ color: 'var(--text-1)', fontWeight: 600, textDecoration: 'none' }}
                      >
                        {a.initiative_code} — {a.initiative_title}
                      </Link>
                      <span className="meta">{a.needs === 'SIGNATURE' ? 'Aprobada — falta firma de Presidencia' : 'Enviada a revisión'}</span>
                    </div>
                    <ActaApprovalActions initiativeCode={a.initiative_code} actaId={a.id} needs={a.needs} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.radarInputs.length > 0 && (
            <div className="panel priority">
              <div className="panel-head">
                <h5>Radar operativo — en revisión</h5>
                <span className="badge b-rojo">{pending.radarInputs.length}</span>
              </div>
              <div className="list-items">
                {pending.radarInputs.map((r) => (
                  <div key={r.id} className="list-item urgent">
                    <div>
                      <Link
                        href={`/iniciativas/${r.initiative_code}/radar/${r.id}`}
                        style={{ color: 'var(--text-1)', fontWeight: 600, textDecoration: 'none' }}
                      >
                        {r.title}
                      </Link>
                      <span className="meta">
                        {r.initiative_code} · {INPUT_KIND_LABELS[r.kind as keyof typeof INPUT_KIND_LABELS] ?? r.kind} ·{' '}
                        <span className={`badge ${PRIORITY_STYLES[r.priority as keyof typeof PRIORITY_STYLES]}`}>
                          {PRIORITY_LABELS[r.priority as keyof typeof PRIORITY_LABELS] ?? r.priority}
                        </span>
                      </span>
                    </div>
                    <RadarApprovalActions initiativeCode={r.initiative_code} inputId={r.id} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
