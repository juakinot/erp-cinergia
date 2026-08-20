import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppShell } from '@/components/app-shell';

const TYPE_LABELS: Record<string, string> = { EVENT: 'Evento', CAMPAIGN: 'Campaña', PROJECT: 'Proyecto' };
const RISK_LABELS: Record<string, string> = { GREEN: 'Verde', AMBER: 'Naranja', RED: 'Rojo' };

interface ReportInitiativeRow {
  code: string;
  area: string;
  area_name: string;
  type: string;
  status: string;
  risk_level: string;
  projected_budget: string | null;
  closed_at: string | null;
  days_to_close: number | null;
}

interface ReportProgressRow {
  code: string;
  area: string;
  type: string;
  status: string;
  risk_level: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  blocked_tasks: number;
  on_time_pct: number | null;
  checklist_pct: number | null;
  radar_inputs: number;
  radar_conversion_pct: number | null;
  survey_responses: number | null;
  survey_avg_score: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export default async function ReportsPage() {
  const user = await requireUser();
  // D8: estas vistas están bloqueadas para anon/authenticated a nivel de
  // Postgres — solo service_role puede leerlas. La autorización real vive
  // acá, en código de servidor, no en RLS.
  if (user.role !== 'PRESIDENT' && user.role !== 'REPORTS_DIRECTOR') redirect('/');

  const admin = createAdminClient();
  const supabase = await createClient();

  const [{ data: initiativesData }, { data: progressData }, { data: areas }, { count: proposalsCount }] =
    await Promise.all([
      admin.from('v_report_initiatives').select('*'),
      admin.from('v_report_progress').select('*'),
      supabase.from('areas').select('slug, name').order('name'),
      supabase
        .from('improvement_proposals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PROPOSED'),
    ]);

  const initiatives = (initiativesData ?? []) as ReportInitiativeRow[];
  const progress = (progressData ?? []) as ReportProgressRow[];
  const areaNameBySlug = new Map((areas ?? []).map((a) => [a.slug, a.name]));

  const active = initiatives.filter((i) => i.status !== 'CLOSED');
  const closedWithDuration = initiatives.filter((i) => i.status === 'CLOSED' && i.days_to_close !== null);
  const avgDaysToClose = average(closedWithDuration.map((i) => i.days_to_close as number));

  const onTimeValues = progress.filter((p) => p.on_time_pct !== null).map((p) => p.on_time_pct as number);
  const avgOnTimePct = average(onTimeValues);

  const totalRadarInputs = progress.reduce((sum, p) => sum + p.radar_inputs, 0);
  const radarConversionValues = progress.filter((p) => p.radar_conversion_pct !== null).map((p) => p.radar_conversion_pct as number);
  const avgRadarConversion = average(radarConversionValues);

  const byArea = new Map<string, ReportProgressRow[]>();
  for (const p of progress) {
    const list = byArea.get(p.area) ?? [];
    list.push(p);
    byArea.set(p.area, list);
  }
  const areaRows = [...byArea.entries()].map(([slug, rows]) => ({
    name: areaNameBySlug.get(slug) ?? slug,
    onTimePct: average(rows.filter((r) => r.on_time_pct !== null).map((r) => r.on_time_pct as number)),
    initiativeCount: rows.length,
  }));

  const riskCounts = { GREEN: 0, AMBER: 0, RED: 0 } as Record<string, number>;
  for (const i of active) riskCounts[i.risk_level] = (riskCounts[i.risk_level] ?? 0) + 1;

  return (
    <AppShell user={user} active="/reportes">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>
            Rendimiento por área
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            Datos agregados de las 3 áreas — sin acceso al detalle operativo de ninguna iniciativa. Si necesitas
            profundizar en algo puntual, es una <Link href="/propuestas">Propuesta de mejora</Link> o una
            conversación directa con el Director de Área.
          </p>
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 20 }}>
        <div className="kpi">
          <div className="k-label">Iniciativas activas</div>
          <div className="k-value">{active.length}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Tiempo prom. de cierre</div>
          <div className="k-value">{avgDaysToClose !== null ? `${avgDaysToClose}d` : '—'}</div>
        </div>
        <div className={`kpi ${avgOnTimePct !== null && avgOnTimePct < 70 ? 'warn' : ''}`}>
          <div className="k-label">Cumplimiento a tiempo</div>
          <div className="k-value">{avgOnTimePct !== null ? `${avgOnTimePct}%` : '—'}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Volumen Radar</div>
          <div className="k-value">{totalRadarInputs}</div>
          <span className="k-delta">{avgRadarConversion !== null ? `${avgRadarConversion}% conversión` : 'sin datos'}</span>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h5>Comparativo entre áreas — cumplimiento a tiempo</h5>
        </div>
        {areaRows.length === 0 ? (
          <div className="empty">Sin iniciativas con tareas registradas todavía.</div>
        ) : (
          <div className="event-list">
            {areaRows.map((a) => (
              <div key={a.name} className="event-card">
                <div className={`rail ${a.onTimePct !== null && a.onTimePct < 70 ? 'warn' : ''}`} />
                <div>
                  <span className="title">{a.name}</span>
                  <span className="sub">{a.initiativeCount} iniciativa(s) con tareas</span>
                </div>
                <div className="stat">
                  <b>{a.onTimePct !== null ? `${a.onTimePct}%` : '—'}</b>a tiempo
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="note" style={{ marginTop: 8 }}>
          Leído de <code>v_report_progress</code> — agregado, nunca de las tablas operativas crudas de cada área.
        </p>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h5>Semáforo agregado — iniciativas activas</h5>
          </div>
          {active.length === 0 ? (
            <div className="empty">Sin iniciativas activas todavía.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {(['RED', 'AMBER', 'GREEN'] as const).map((level) => (
                <div key={level} className="event-card">
                  <div className={`rail ${level === 'RED' ? 'crit' : level === 'AMBER' ? 'warn' : ''}`} />
                  <div>
                    <span className="title">{RISK_LABELS[level]}</span>
                  </div>
                  <div className="stat">
                    <b>{riskCounts[level] ?? 0}</b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h5>Propuestas de mejora</h5>
            <Link href="/propuestas" className="link">
              Ver todas →
            </Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {proposalsCount ?? 0} propuesta(s) esperando decisión.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h5>Detalle por iniciativa — avance agregado</h5>
        </div>
        {progress.length === 0 ? (
          <div className="empty">Sin iniciativas todavía.</div>
        ) : (
          <div className="table-wrap">
            <table className="spec compact">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Tareas</th>
                  <th>A tiempo</th>
                  <th>Checklist</th>
                  <th>Radar</th>
                  <th>Encuesta</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => (
                  <tr key={p.code}>
                    <td className="mono">{p.code}</td>
                    <td>{TYPE_LABELS[p.type] ?? p.type}</td>
                    <td>
                      {p.completed_tasks}/{p.total_tasks}
                      {p.overdue_tasks > 0 && <span style={{ color: 'var(--alert-crit)' }}> · {p.overdue_tasks} vencidas</span>}
                    </td>
                    <td>{p.on_time_pct !== null ? `${p.on_time_pct}%` : '—'}</td>
                    <td>{p.checklist_pct !== null ? `${p.checklist_pct}%` : '—'}</td>
                    <td>{p.radar_inputs > 0 ? `${p.radar_inputs} (${p.radar_conversion_pct ?? 0}% conv.)` : '—'}</td>
                    <td>{p.survey_avg_score !== null ? `${p.survey_avg_score}/5 (${p.survey_responses})` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
