import Link from 'next/link';
import { logout } from '@/app/actions';
import { ROLE_LABELS } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { getPendingApprovals, pendingCount } from '@/lib/approvals/queries';
import { getUnreadNotificationCount } from '@/lib/notifications/queries';
import type { AppRole } from '@/lib/initiatives/types';

interface NavItem {
  label: string;
  href: string;
  roles?: AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Iniciativas', href: '/iniciativas' },
  { label: 'Aprobaciones', href: '/aprobaciones', roles: ['PRESIDENT', 'AREA_DIRECTOR'] },
  { label: 'Semáforo', href: '/semaforo', roles: ['PRESIDENT', 'AREA_DIRECTOR', 'REPORTS_DIRECTOR', 'COORDINATOR'] },
  { label: 'Propuestas de mejora', href: '/propuestas', roles: ['PRESIDENT', 'AREA_DIRECTOR', 'REPORTS_DIRECTOR'] },
  { label: 'Mi Kanban', href: '/mi-kanban', roles: ['PRESIDENT', 'AREA_DIRECTOR', 'COORDINATOR', 'MEMBER'] },
  { label: 'Ideación', href: '/ideas' },
  { label: 'Calendario', href: '/calendario' },
  { label: 'Miembros', href: '/miembros' },
  { label: 'Usuarios', href: '/usuarios', roles: ['PRESIDENT'] },
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

  const supabase = await createClient();

  let approvalsCount = 0;
  if (user.role === 'PRESIDENT' || user.role === 'AREA_DIRECTOR') {
    const pending = await getPendingApprovals(supabase, { id: user.id, role: user.role, areaId: user.areaId ?? null });
    approvalsCount = pendingCount(pending);
  }

  const unreadCount = await getUnreadNotificationCount(supabase, user.id);

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
