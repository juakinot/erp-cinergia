import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/initiatives/types';
import { AppShell } from '@/components/app-shell';

interface SummaryRow {
  id: string;
  title: string;
  type: 'EVENT' | 'CAMPAIGN' | 'PROJECT';
  status: string;
  planned_date: string | null;
  planned_end_date: string | null;
  closed_at: string | null;
  areas: { name: string } | { name: string }[] | null;
  coordinator: { full_name: string } | { full_name: string }[] | null;
}

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha definida';
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * `/resumen` — la única pantalla del rol DEAN (D35). Deliberadamente
 * fuera de `can_access_area` en RLS (mismo criterio que REPORTS_DIRECTOR,
 * D8): un Decano no tiene ningún grant directo sobre `initiatives` ni
 * ninguna otra tabla operativa — toda la lectura pasa por el chequeo de
 * rol de acá y el cliente admin, nunca por RLS. Column-level a propósito:
 * la consulta solo trae título/tipo/estado/fecha/área/coordinador — nada
 * de presupuesto, tareas, radar ni encuestas, que es justo lo que pidió
 * "sin métricas, solo un resumen".
 */
export default async function ResumenPage() {
  const user = await requireUser();
  if (user.role !== 'DEAN') redirect('/');

  const admin = createAdminClient();
  const { data } = await admin
    .from('initiatives')
    .select(
      'id, title, type, status, planned_date, planned_end_date, closed_at, areas(name), coordinator:coordinator_user_id(full_name)'
    )
    .in('status', ['APPROVED', 'PLANNING', 'READY', 'EXECUTION', 'POST_EVENT', 'CLOSED'])
    .order('planned_date', { ascending: true, nullsFirst: false });

  const rows = (data ?? []) as unknown as SummaryRow[];

  const enCurso = rows.filter((r) => r.status === 'EXECUTION' || r.status === 'POST_EVENT');
  const proximos = rows.filter((r) => ['APPROVED', 'PLANNING', 'READY'].includes(r.status));
  const cerrados = rows
    .filter((r) => r.status === 'CLOSED')
    .sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''))
    .slice(0, 8);

  function Card({ row }: { row: SummaryRow }) {
    const area = one(row.areas);
    const coordinator = one(row.coordinator);
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{row.title}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-2)' }}>
              {TYPE_LABELS[row.type]} · {area?.name ?? '—'}
              {coordinator?.full_name && ` · Coordina ${coordinator.full_name}`}
            </p>
          </div>
          <span className="badge b-info">{STATUS_LABELS[row.status as keyof typeof STATUS_LABELS]}</span>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--text-2)' }}>
          {row.status === 'CLOSED' ? `Culminado el ${formatDate(row.closed_at)}` : formatDate(row.planned_date)}
        </p>
      </div>
    );
  }

  return (
    <AppShell user={user} active="/resumen">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>
            Resumen de actividades
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            Vista de solo lectura para transparencia — qué está en curso, qué viene y qué se cerró recientemente.
            Sin cifras de presupuesto ni métricas internas.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>En curso ahora</h3>
          {enCurso.length === 0 ? (
            <div className="empty">Nada en ejecución en este momento.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {enCurso.map((r) => (
                <Card key={r.id} row={r} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Próximos</h3>
          {proximos.length === 0 ? (
            <div className="empty">Nada planificado por ahora.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {proximos.map((r) => (
                <Card key={r.id} row={r} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            Culminados recientemente
          </h3>
          {cerrados.length === 0 ? (
            <div className="empty">Todavía no hay actividades cerradas.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {cerrados.map((r) => (
                <Card key={r.id} row={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
