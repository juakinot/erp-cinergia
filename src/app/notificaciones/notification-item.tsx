'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markAsRead } from './actions';
import type { NotificationRow } from '@/lib/notifications/queries';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function NotificationItem({
  notification,
  categoryLabel,
}: {
  notification: NotificationRow;
  categoryLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isUnread = !notification.read_at;

  function markRead() {
    startTransition(async () => {
      await markAsRead(notification.id);
      router.refresh();
    });
  }

  const content = (
    <div>
      <strong>{notification.title}</strong>
      <span className="meta">
        {categoryLabel} · {timeAgo(notification.created_at)}
        {notification.body && ` · ${notification.body}`}
      </span>
    </div>
  );

  return (
    <div className={`list-item ${isUnread ? 'urgent' : ''}`}>
      {notification.link_path ? (
        <Link href={notification.link_path} style={{ color: 'inherit', textDecoration: 'none' }} onClick={markRead}>
          {content}
        </Link>
      ) : (
        content
      )}
      {isUnread && (
        <div className="actions">
          <button type="button" disabled={pending} className="btn subtle" onClick={markRead}>
            Marcar leída
          </button>
        </div>
      )}
    </div>
  );
}
