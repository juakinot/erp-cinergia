import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABELS } from '@/lib/roles';
import type { AppRole } from '@/lib/initiatives/types';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-[#CFE7DC] text-[#2C7A5A]',
  INACTIVE: 'bg-[#E8EEF5] text-[#5A6B82]',
  BLOCKED: 'bg-[#F4D2D5] text-[#B4232F]',
};

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== 'PRESIDENT') redirect('/');

  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status, created_at, areas(name)')
    .order('created_at', { ascending: false });

  return (
    <main className="flex min-h-screen flex-col bg-[#F4F7FB]">
      <header className="flex items-center justify-between border-b border-[#E8EEF5] bg-white px-6 py-4">
        <p className="font-mono text-xs tracking-[0.14em] text-[#5A6B82] uppercase">CINERGIA · ERP</p>
        <Link href="/" className="text-xs font-medium text-[#5A6B82] hover:text-[#003360]">
          Inicio
        </Link>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#003360]">Usuarios</h1>
            <p className="text-sm text-[#5A6B82]">Directorio completo — solo visible para Presidencia.</p>
          </div>
          <Link
            href="/usuarios/nuevo"
            className="rounded-md bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0059B3]"
          >
            + Invitar usuario
          </Link>
        </div>

        {error && (
          <p className="rounded-md bg-[#F4D2D5] px-4 py-3 text-sm text-[#B4232F]">
            No se pudo cargar el directorio: {error.message}
          </p>
        )}

        {!error && (
          <div className="overflow-hidden rounded-lg border border-[#E8EEF5] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#F4F7FB] text-left text-xs tracking-[0.06em] text-[#5A6B82] uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Nombre</th>
                  <th className="px-4 py-2.5 font-medium">Correo</th>
                  <th className="px-4 py-2.5 font-medium">Rol</th>
                  <th className="px-4 py-2.5 font-medium">Área</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
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
                    <tr key={u.id} className="border-t border-[#E8EEF5]">
                      <td className="px-4 py-3 font-medium text-[#003360]">{u.full_name}</td>
                      <td className="px-4 py-3 text-[#5A6B82]">{u.email}</td>
                      <td className="px-4 py-3 text-[#5A6B82]">{ROLE_LABELS[u.role]}</td>
                      <td className="px-4 py-3 text-[#5A6B82]">{areaName ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[u.status] ?? ''}`}
                        >
                          {u.status === 'ACTIVE' ? 'Activo' : u.status === 'INACTIVE' ? 'Inactivo' : 'Bloqueado'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
