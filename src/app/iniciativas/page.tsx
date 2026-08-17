import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABELS, TYPE_LABELS, type InitiativeRow } from '@/lib/initiatives/types';
import { AppShell } from '@/components/app-shell';

const RISK_BADGE: Record<string, string> = {
  GREEN: 'b-verde',
  AMBER: 'b-amarillo',
  RED: 'b-rojo',
};
const RISK_LABEL: Record<string, string> = { GREEN: 'Verde', AMBER: 'Naranja', RED: 'Rojo' };

export default async function InitiativesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Sin filtro manual de área: RLS ya decide qué filas puede ver esta
  // sesión (initiatives_select en 01_rls_policies.sql).
  const { data: initiatives, error } = await supabase
    .from('initiatives')
    .select('id, code, title, type, status, risk_level, planned_date, areas(name)')
    .order('created_at', { ascending: false });

  const canCreate = user.role === 'PRESIDENT' || user.role === 'AREA_DIRECTOR';

  return (
    <AppShell user={user} active="/iniciativas">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Iniciativas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            {user.area ? `Área: ${user.area.name}` : 'Alcance: las 3 áreas'}
          </p>
        </div>
        {canCreate && (
          <Link href="/iniciativas/nueva" className="btn primary">
            + Nueva iniciativa
          </Link>
        )}
      </div>

      {error && (
        <p className="badge b-rojo" style={{ display: 'block', padding: '10px 14px' }}>
          No se pudieron cargar las iniciativas: {error.message}
        </p>
      )}

      {!error && (!initiatives || initiatives.length === 0) && (
        <div className="empty">No hay iniciativas visibles para tu rol todavía.</div>
      )}

      {!error && initiatives && initiatives.length > 0 && (
        <div className="table-wrap">
          <table className="spec">
            <thead>
              <tr>
                <th>Código</th>
                <th>Título</th>
                <th>Área</th>
                <th>Estado</th>
                <th>Semáforo</th>
              </tr>
            </thead>
            <tbody>
              {(
                initiatives as unknown as Array<
                  Pick<InitiativeRow, 'id' | 'code' | 'title' | 'type' | 'status' | 'risk_level' | 'planned_date'> & {
                    areas: { name: string } | { name: string }[] | null;
                  }
                >
              ).map((i) => {
                const areaName = Array.isArray(i.areas) ? i.areas[0]?.name : i.areas?.name;
                return (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/iniciativas/${i.code}`} className="rn">
                        {i.code}
                      </Link>
                    </td>
                    <td>
                      <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-1)' }}>{i.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-2)' }}>{TYPE_LABELS[i.type]}</p>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{areaName ?? '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{STATUS_LABELS[i.status]}</td>
                    <td>
                      <span className={`badge ${RISK_BADGE[i.risk_level]}`}>{RISK_LABEL[i.risk_level]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
