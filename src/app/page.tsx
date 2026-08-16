import { requireUser } from '@/lib/auth';
import { logout } from './actions';

const ROLE_LABELS: Record<string, string> = {
  PRESIDENT: 'Presidente / Vicepresidente',
  AREA_DIRECTOR: 'Director de Área',
  REPORTS_DIRECTOR: 'Director de Reportes',
  COORDINATOR: 'Coordinador',
  MEMBER: 'Miembro',
};

export default async function Home() {
  const user = await requireUser();

  return (
    <main className="flex min-h-screen flex-col bg-[#F4F7FB]">
      <header className="flex items-center justify-between border-b border-[#E8EEF5] bg-white px-6 py-4">
        <p className="font-mono text-xs tracking-[0.14em] text-[#5A6B82] uppercase">
          CINERGIA · ERP
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-[#D3DDEA] px-3 py-1.5 text-xs font-medium text-[#5A6B82] hover:bg-[#F4F7FB]"
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-[#E8EEF5] bg-white p-8 shadow-sm">
          <h1 className="text-lg font-bold text-[#003360]">Bienvenido, {user.fullName}</h1>
          <dl className="mt-6 flex flex-col gap-4 text-sm">
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-[#B6C2D2] uppercase">
                Rol
              </dt>
              <dd className="mt-0.5 font-medium text-[#003360]">
                {ROLE_LABELS[user.role] ?? user.role}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-[#B6C2D2] uppercase">
                Área
              </dt>
              <dd className="mt-0.5 font-medium text-[#003360]">
                {user.area?.name ?? 'Todas (alcance cross-área)'}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-[#B6C2D2] uppercase">
                Correo
              </dt>
              <dd className="mt-0.5 font-medium text-[#003360]">{user.email}</dd>
            </div>
          </dl>
          <p className="mt-6 text-xs text-[#5A6B82]">
            Sesión verificada de extremo a extremo: Supabase Auth → RLS → perfil de{' '}
            <code className="rounded bg-[#E8EEF5] px-1 py-0.5">public.users</code>.
          </p>
        </div>
      </div>
    </main>
  );
}
