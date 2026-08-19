import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { VISIBILITY_LABELS, type ObservationRow } from '@/lib/observations/types';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';
import { NewObservationForm } from './new-observation-form';
import { ObservationThread } from './observation-thread';

export default async function ObservationsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('id, code, title')
    .eq('code', code)
    .maybeSingle();
  if (!initiative) notFound();

  const row = initiative as { id: string; code: string; title: string };

  const { data } = await supabase
    .from('observations')
    .select(
      'id, initiative_id, author_user_id, body, visibility, resolved, resolved_at, parent_id, source_input_id, created_at, author:author_user_id(full_name)'
    )
    .eq('initiative_id', row.id)
    .order('created_at', { ascending: true });

  const all = (data ?? []) as unknown as ObservationRow[];
  const threads = all.filter((o) => !o.parent_id);
  const repliesByParent = new Map<string, ObservationRow[]>();
  for (const o of all) {
    if (o.parent_id) {
      const list = repliesByParent.get(o.parent_id) ?? [];
      list.push(o);
      repliesByParent.set(o.parent_id, list);
    }
  }

  const canModerate = user.role === 'PRESIDENT' || user.role === 'AREA_DIRECTOR';
  const canOpenThread = user.role !== 'MEMBER';

  return (
    <AppShell user={user} active="/iniciativas">
      <Breadcrumb backHref={`/iniciativas/${row.code}`} backLabel={row.code} code="Observaciones" />
      <h1 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{row.title}</h1>

      <div className="flex flex-col gap-4">
        {canOpenThread ? (
          <NewObservationForm initiativeCode={row.code} />
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Como Miembro puedes responder observaciones existentes, pero no abrir una nueva.
          </p>
        )}

        {threads.length === 0 ? (
          <div className="empty">Todavía no hay observaciones en esta iniciativa.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {threads.map((t) => (
              <ObservationThread
                key={t.id}
                initiativeCode={row.code}
                observation={t}
                replies={repliesByParent.get(t.id) ?? []}
                currentUserId={user.id}
                canModerate={canModerate}
                visibilityLabel={VISIBILITY_LABELS[t.visibility]}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
