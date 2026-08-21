import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';

const TYPE_LABELS: Record<string, string> = { EVENT: 'Evento', CAMPAIGN: 'Campaña', PROJECT: 'Proyecto' };
const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprobado',
  PLANNING: 'En planificación',
  READY: 'Listo para ejecución',
  EXECUTION: 'En ejecución',
  POST_EVENT: 'Post-evento',
};

const ACTIVE_STATUSES = ['APPROVED', 'PLANNING', 'READY', 'EXECUTION', 'POST_EVENT'];

interface SemaforoRow {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  area_name: string;
  overdueTasks: number;
  pendingRadar: number;
  color: 'crit' | 'warn' | 'ok';
}

export default async function SemaforoPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: initiatives } = await supabase
    .from('initiatives')
    .select('id, code, title, type, status, areas(name)')
    .in('status', ACTIVE_STATUSES)
    .order('code');

  const rows = (initiatives ?? []) as unknown as {
    id: string;
    code: string;
    title: string;
    type: string;
    status: string;
    areas: { name: string } | { name: string }[] | null;
  }[];

  const ids = rows.map((r) => r.id);

  const nowIso = new Date().toISOString();
  const overdueByInitiative = new Map<string, number>();
  const radarByInitiative = new Map<string, number>();

  if (ids.length > 0) {
    const [{ data: overdueTasks }, { data: pendingInputs }] = await Promise.all([
      supabase
        .from('tasks')
        .select('initiative_id')
        .in('initiative_id', ids)
        .lt('due_date', nowIso)
        .not('status', 'in', '(COMPLETED,CANCELLED)'),
      supabase
        .from('initiative_inputs')
        .select('initiative_id')
        .in('initiative_id', ids)
        .in('status', ['PROPOSED', 'IN_REVIEW']),
    ]);
    for (const t of overdueTasks ?? []) {
      overdueByInitiative.set(t.initiative_id, (overdueByInitiative.get(t.initiative_id) ?? 0) + 1);
    }
    for (const i of pendingInputs ?? []) {
      radarByInitiative.set(i.initiative_id, (radarByInitiative.get(i.initiative_id) ?? 0) + 1);
    }
  }

  function areaName(field: { name: string } | { name: string }[] | null) {
    const a = Array.isArray(field) ? field[0] : field;
    return a?.name ?? '—';
  }

  const semaforo: SemaforoRow[] = rows.map((r) => {
    const overdueTasks = overdueByInitiative.get(r.id) ?? 0;
    const pendingRadar = radarByInitiative.get(r.id) ?? 0;
    const color: SemaforoRow['color'] = overdueTasks > 0 ? 'crit' : pendingRadar > 0 ? 'warn' : 'ok';
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      type: r.type,
      status: r.status,
      area_name: areaName(r.areas),
      overdueTasks,
      pendingRadar,
      color,
    };
  });

  semaforo.sort((a, b) => {
    const rank = { crit: 0, warn: 1, ok: 2 };
    return rank[a.color] - rank[b.color];
  });

  const critCount = semaforo.filter((s) => s.color === 'crit').length;
  const warnCount = semaforo.filter((s) => s.color === 'warn').length;

  return (
    <AppShell user={user} active="/semaforo">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Semáforo de iniciativas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            Color calculado en vivo — rojo por tareas vencidas, naranja por Radar sin atender. No es el campo{' '}
            <code>risk_level</code> (todavía no lo actualiza ningún proceso, queda documentado como pendiente).
          </p>
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 20 }}>
        <div className="kpi">
          <div className="k-label">Iniciativas activas</div>
          <div className="k-value">{semaforo.length}</div>
        </div>
        <div className={`kpi ${critCount > 0 ? 'crit' : ''}`}>
          <div className="k-label">En rojo</div>
          <div className="k-value">{critCount}</div>
        </div>
        <div className={`kpi ${warnCount > 0 ? 'warn' : ''}`}>
          <div className="k-label">En naranja</div>
          <div className="k-value">{warnCount}</div>
        </div>
      </div>

      {semaforo.length === 0 ? (
        <div className="empty">No hay iniciativas activas todavía.</div>
      ) : (
        <div className="event-list">
          {semaforo.map((s) => (
            <Link key={s.id} href={`/iniciativas/${s.code}`} className="event-card">
              <div className={`rail ${s.color}`} />
              <div>
                <span className="code">{s.code}</span>
                <span className="title">{s.title}</span>
                <span className="sub">
                  {TYPE_LABELS[s.type] ?? s.type} · {s.area_name} · {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </div>
              <div className="stat">
                {s.overdueTasks > 0 ? (
                  <>
                    <b>{s.overdueTasks}</b>vencidas
                  </>
                ) : s.pendingRadar > 0 ? (
                  <>
                    <b>{s.pendingRadar}</b>radar sin ver
                  </>
                ) : (
                  <b>—</b>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
