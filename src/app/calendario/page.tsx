import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { KIND_BADGE, KIND_LABELS, VISIBILITY_LABELS, type CalendarItemRow } from '@/lib/calendar/types';
import { NewCalendarItemForm } from './new-calendar-item-form';
import { DeleteItemButton } from './delete-item-button';

// Sin timeZone explícito, Intl formatea con la zona del proceso que
// corre el servidor (no necesariamente Lima) — mismo motivo que
// toLimaInstant() en actions.ts, ahora del lado de lectura.
const LIMA_TZ = 'America/Lima';

function formatRange(startsAt: string, endsAt: string, allDay: boolean) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFmt = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: LIMA_TZ });
  const timeFmt = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: LIMA_TZ });
  if (allDay) return dateFmt.format(start);
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

export default async function CalendarPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('calendar_items')
    .select(
      'id, initiative_id, title, description, starts_at, ends_at, all_day, location, kind, visibility, created_by_user_id, created_by:created_by_user_id(full_name)'
    )
    .is('initiative_id', null)
    .order('starts_at', { ascending: true });

  const items = (data ?? []) as unknown as CalendarItemRow[];
  const nowIso = new Date().toISOString();
  const upcoming = items.filter((i) => i.ends_at >= nowIso);
  const past = items.filter((i) => i.ends_at < nowIso).reverse();

  function personName(field: CalendarItemRow['created_by']) {
    const p = Array.isArray(field) ? field[0] : field;
    return p?.full_name ?? '—';
  }

  function ItemCard({ item }: { item: CalendarItemRow }) {
    const canDelete = item.created_by_user_id === user.id || user.role === 'PRESIDENT';
    return (
      <div className="panel" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{item.title}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
              {formatRange(item.starts_at, item.ends_at, item.all_day)}
              {item.location && ` · ${item.location}`}
            </p>
            {item.description && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-1)' }}>{item.description}</p>
            )}
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`badge ${KIND_BADGE[item.kind]}`}>{KIND_LABELS[item.kind]}</span>
              <span className="badge b-neutral">{VISIBILITY_LABELS[item.visibility]}</span>
              <span className="badge b-neutral">{personName(item.created_by)}</span>
            </div>
          </div>
          {canDelete && <DeleteItemButton itemId={item.id} />}
        </div>
      </div>
    );
  }

  return (
    <AppShell user={user} active="/calendario">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Calendario general</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            Eventos compartidos, no atados a una iniciativa específica.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <NewCalendarItemForm />

        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Próximos</h3>
          {upcoming.length === 0 ? (
            <div className="empty">No hay eventos próximos.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Pasados</h3>
            <div className="flex flex-col gap-2">
              {past.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
