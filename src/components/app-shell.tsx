import Link from 'next/link';
import { logout } from '@/app/actions';
import { ROLE_LABELS } from '@/lib/roles';
import type { AppRole } from '@/lib/initiatives/types';

interface NavItem {
  label: string;
  href: string;
  roles?: AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Iniciativas', href: '/iniciativas' },
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
export function AppShell({
  user,
  active,
  children,
}: {
  user: { fullName: string; role: AppRole; area?: { name: string } | null };
  active: string;
  children: React.ReactNode;
}) {
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));

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
