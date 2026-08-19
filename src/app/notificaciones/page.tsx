import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import type { NotificationRow } from '@/lib/notifications/queries';
import { NotificationItem } from './notification-item';
import { MarkAllReadButton } from './mark-all-read-button';

const CATEGORY_LABELS: Record<string, string> = {
  DUE_DATES: 'Vencimientos',
  APPROVALS: 'Aprobaciones',
  RADAR: 'Radar',
  INITIATIVES: 'Iniciativas',
  SYSTEM: 'Sistema',
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('notifications')
    .select('id, category, kind, subject_type, subject_id, title, body, link_path, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const notifications = (data ?? []) as NotificationRow[];
  const unread = notifications.filter((n) => !n.read_at);

  return (
    <AppShell user={user} active="">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Notificaciones</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            {unread.length > 0 ? `${unread.length} sin leer` : 'Todo al día.'}
          </p>
        </div>
        {unread.length > 0 && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <div className="empty">No tienes notificaciones todavía.</div>
      ) : (
        <div className="list-items">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} categoryLabel={CATEGORY_LABELS[n.category] ?? n.category} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
