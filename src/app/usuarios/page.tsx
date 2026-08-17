import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABELS } from '@/lib/roles';
import type { AppRole } from '@/lib/initiatives/types';
import { AppShell } from '@/components/app-shell';

const STATUS_BADGE: Record<string, string> = { ACTIVE: 'b-verde', INACTIVE: 'b-neutral', BLOCKED: 'b-rojo' };
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Activo', INACTIVE: 'Inactivo', BLOCKED: 'Bloqueado' };

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== 'PRESIDENT') redirect('/');

  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status, created_at, areas(name)')
    .order('created_at', { ascending: false });

  return (
    <AppShell user={user} active="/usuarios">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Usuarios</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            Directorio completo — solo visible para Presidencia.
          </p>
        </div>
        <Link href="/usuarios/nuevo" className="btn primary">
          + Invitar usuario
        </Link>
      </div>

      {error && (
        <p className="badge b-rojo" style={{ display: 'block', padding: '10px 14px' }}>
          No se pudo cargar el directorio: {error.message}
        </p>
      )}

      {!error && (
        <div className="table-wrap">
          <table className="spec">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Área</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(
                users as unknown as Array<{
                  id: string;
                  full_name: string;
                  email: string;
                  role: AppRole;
                  status: string;
                  areas: { name: string } | { name: string }[] | null;
                }>
              )?.map((u) => {
                const areaName = Array.isArray(u.areas) ? u.areas[0]?.name : u.areas?.name;
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{u.full_name}</td>
                    <td style={{ color: 'var(--text-2)' }}>{u.email}</td>
                    <td style={{ color: 'var(--text-2)' }}>{ROLE_LABELS[u.role]}</td>
                    <td style={{ color: 'var(--text-2)' }}>{areaName ?? '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[u.status] ?? ''}`}>{STATUS_LABEL[u.status] ?? u.status}</span>
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
