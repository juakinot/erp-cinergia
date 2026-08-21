import Link from 'next/link';
import { logout } from '@/app/actions';
import { ROLE_LABELS } from '@/lib/roles';
import { getShellCounts } from '@/lib/shell-counts';
import type { AppRole } from '@/lib/initiatives/types';

interface NavItem {
  label: string;
  href: string;
  roles?: AppRole[];
}

/** Los 5 roles internos — todo lo que no es explícitamente para DEAN. */
const INTERNAL_ROLES: AppRole[] = ['PRESIDENT', 'AREA_DIRECTOR', 'REPORTS_DIRECTOR', 'COORDINATOR', 'MEMBER'];

const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', href: '/', roles: INTERNAL_ROLES },
  { label: 'Iniciativas', href: '/iniciativas', roles: INTERNAL_ROLES },
  { label: 'Aprobaciones', href: '/aprobaciones', roles: ['PRESIDENT', 'AREA_DIRECTOR'] },
  { label: 'Semáforo', href: '/semaforo', roles: ['PRESIDENT', 'AREA_DIRECTOR', 'REPORTS_DIRECTOR', 'COORDINATOR'] },
  { label: 'Propuestas de mejora', href: '/propuestas', roles: ['PRESIDENT', 'AREA_DIRECTOR', 'REPORTS_DIRECTOR'] },
  { label: 'Rendimiento por área', href: '/reportes', roles: ['PRESIDENT', 'REPORTS_DIRECTOR'] },
  { label: 'Mi Kanban', href: '/mi-kanban', roles: ['PRESIDENT', 'AREA_DIRECTOR', 'COORDINATOR', 'MEMBER'] },
  { label: 'Ideación', href: '/ideas', roles: INTERNAL_ROLES },
  { label: 'Calendario', href: '/calendario', roles: INTERNAL_ROLES },
  { label: 'Miembros', href: '/miembros', roles: INTERNAL_ROLES },
  { label: 'Usuarios', href: '/usuarios', roles: ['PRESIDENT'] },
  // Única pantalla del rol DEAN (D35) — externo a CINERGIA, sin acceso a
  // nada más del sistema.
  { label: 'Resumen', href: '/resumen', roles: ['DEAN'] },
];

function initialsOf(fullName: string): string {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/**
 * Shell persistente (sidebar + topbar) de toda página autenticada — antes
 * cada página armaba su propio encabezado suelto sin ningún elemento en
 * común entre ellas. `active` es el href exacto de NAV_ITEMS que debe
 * marcarse, no el pathname real (las subpáginas de una iniciativa no
 * tienen su propio ítem, así que pasan el href del padre, "/iniciativas").
 */
export async function AppShell({
  user,
  active,
  children,
}: {
  user: { id: string; fullName: string; role: AppRole; areaId?: string | null; area?: { name: string } | null };
  active: string;
  children: React.ReactNode;
}) {
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));

  // D33: cacheado 15s (ver src/lib/shell-counts.ts) — antes se recalculaba
  // contra Supabase en cada clic, sin importar que nada hubiera cambiado.
  const { approvalsCount, unreadCount } = await getShellCounts(user.id, user.role, user.areaId ?? null);

  return (
    <div className="app-shell">
      <aside className="app-side">
        <div className="app-brand">
          <span className="mark">CINERGIA</span>
          <span className="sub">ERP</span>
        </div>

        <div className="nav-label">Navegación</div>
        <ul className="nav-list">
          {items.map((item) => (
            <li key={item.href} className={item.href === active ? 'active' : ''}>
              <Link href={item.href}>{item.label}</Link>
              {item.href === '/aprobaciones' && approvalsCount > 0 && (
                <span className="pill warn">{approvalsCount}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="side-context" style={{ marginTop: 'auto' }}>
          <div className="label">Rol</div>
          <div className="value">{ROLE_LABELS[user.role] ?? user.role}</div>
          {user.area && <div className="value">{user.area.name}</div>}
        </div>
      </aside>

      <div className="app-main">
        <div className="topbar">
          <Link href="/notificaciones" className="icon" data-badge={unreadCount > 0 ? String(unreadCount) : undefined}>
            🔔
          </Link>
          <div className="user">
            <span className="avatar">{initialsOf(user.fullName)}</span>
            {user.fullName}
          </div>
          <form action={logout}>
            <button type="submit" className="btn subtle">
              Cerrar sesión
            </button>
          </form>
        </div>

        {children}
      </div>
    </div>
  );
}
