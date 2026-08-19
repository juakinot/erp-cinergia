import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABELS } from '@/lib/roles';
import type { AppRole } from '@/lib/initiatives/types';
import { AppShell } from '@/components/app-shell';

const STATUS_BADGE: Record<string, string> = { ACTIVE: 'b-verde', INACTIVE: 'b-neutral', BLOCKED: 'b-rojo' };
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Activo', INACTIVE: 'Inactivo', BLOCKED: 'Bloqueado' };

interface MemberRow {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  status: string;
  areas: { name: string } | { name: string }[] | null;
}

export default async function MembersPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status, areas(name)')
    .order('full_name');

  const members = (data ?? []) as unknown as MemberRow[];

  function areaName(m: MemberRow) {
    const a = Array.isArray(m.areas) ? m.areas[0] : m.areas;
    return a?.name ?? '—';
  }

  const groups = new Map<string, MemberRow[]>();
  for (const m of members) {
    const key = areaName(m);
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)));

  return (
    <AppShell user={user} active="/miembros">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Miembros</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            {user.role === 'PRESIDENT' || user.role === 'REPORTS_DIRECTOR'
              ? 'Directorio de las 3 áreas.'
              : 'Tu equipo de área.'}
          </p>
        </div>
      </div>

      {error && (
        <p className="badge b-rojo" style={{ display: 'block', padding: '10px 14px' }}>
          No se pudo cargar el directorio: {error.message}
        </p>
      )}

      {!error && members.length === 0 && <div className="empty">No hay miembros visibles todavía.</div>}

      {!error && members.length > 0 && (
        <div className="flex flex-col gap-4">
          {sortedGroups.map(([area, list]) => (
            <div key={area} className="panel">
              <div className="panel-head">
                <h5>{area}</h5>
                <span className="badge b-neutral">{list.length}</span>
              </div>
              <div className="table-wrap">
                <table className="spec">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{m.full_name}</td>
                        <td style={{ color: 'var(--text-2)' }}>{m.email}</td>
                        <td style={{ color: 'var(--text-2)' }}>{ROLE_LABELS[m.role]}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[m.status] ?? ''}`}>
                            {STATUS_LABEL[m.status] ?? m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
