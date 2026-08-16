import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABELS, TYPE_LABELS, type InitiativeRow } from '@/lib/initiatives/types';
import { logout } from '../actions';

const RISK_STYLES: Record<string, string> = {
  GREEN: 'bg-[#CFE7DC] text-[#2C7A5A]',
  AMBER: 'bg-[#FDE4C0] text-[#F29918]',
  RED: 'bg-[#F4D2D5] text-[#B4232F]',
};

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
    <main className="flex min-h-screen flex-col bg-[#F4F7FB]">
      <header className="flex items-center justify-between border-b border-[#E8EEF5] bg-white px-6 py-4">
        <p className="font-mono text-xs tracking-[0.14em] text-[#5A6B82] uppercase">
          CINERGIA · ERP
        </p>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs font-medium text-[#5A6B82] hover:text-[#003360]">
            Inicio
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-[#D3DDEA] px-3 py-1.5 text-xs font-medium text-[#5A6B82] hover:bg-[#F4F7FB]"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#003360]">Iniciativas</h1>
            <p className="text-sm text-[#5A6B82]">
              {user.area ? `Área: ${user.area.name}` : 'Alcance: las 3 áreas'}
            </p>
          </div>
          {canCreate && (
            <Link
              href="/iniciativas/nueva"
              className="rounded-md bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0059B3]"
            >
              + Nueva iniciativa
            </Link>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-[#F4D2D5] px-4 py-3 text-sm text-[#B4232F]">
            No se pudieron cargar las iniciativas: {error.message}
          </p>
        )}

        {!error && (!initiatives || initiatives.length === 0) && (
          <div className="rounded-lg border border-dashed border-[#D3DDEA] bg-white px-6 py-10 text-center text-sm text-[#5A6B82]">
            No hay iniciativas visibles para tu rol todavía.
          </div>
        )}

        {!error && initiatives && initiatives.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-[#E8EEF5] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#F4F7FB] text-left text-xs tracking-[0.06em] text-[#5A6B82] uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Código</th>
                  <th className="px-4 py-2.5 font-medium">Título</th>
                  <th className="px-4 py-2.5 font-medium">Área</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Semáforo</th>
                </tr>
              </thead>
              <tbody>
                {(initiatives as unknown as Array<Pick<InitiativeRow, 'id' | 'code' | 'title' | 'type' | 'status' | 'risk_level' | 'planned_date'> & { areas: { name: string } | { name: string }[] | null }>).map((i) => {
                  const areaName = Array.isArray(i.areas) ? i.areas[0]?.name : i.areas?.name;
                  return (
                    <tr key={i.id} className="border-t border-[#E8EEF5] hover:bg-[#F4F7FB]">
                      <td className="px-4 py-3">
                        <Link href={`/iniciativas/${i.code}`} className="font-mono text-xs font-semibold text-[#0066CC]">
                          {i.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#003360]">{i.title}</p>
                        <p className="text-xs text-[#5A6B82]">{TYPE_LABELS[i.type]}</p>
                      </td>
                      <td className="px-4 py-3 text-[#5A6B82]">{areaName ?? '—'}</td>
                      <td className="px-4 py-3 text-[#5A6B82]">{STATUS_LABELS[i.status]}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${RISK_STYLES[i.risk_level]}`}
                        >
                          {i.risk_level === 'GREEN' ? 'Verde' : i.risk_level === 'AMBER' ? 'Naranja' : 'Rojo'}
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
