import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canManageInitiative } from '@/lib/initiatives/permissions';
import type { LogisticsItemRow } from '@/lib/logistics/types';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';
import { CreateChecklistButton } from './create-checklist-button';
import { ChecklistView } from './checklist-view';

export default async function LogisticsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('id, code, title, type, area_id, coordinator_user_id')
    .eq('code', code)
    .maybeSingle();

  if (!initiative) notFound();

  const row = initiative as {
    id: string;
    code: string;
    title: string;
    type: 'EVENT' | 'CAMPAIGN' | 'PROJECT';
    area_id: string;
    coordinator_user_id: string;
  };

  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  const isManager = canManageInitiative(actor, row);

  const { data: checklist } = await supabase
    .from('logistics_checklists')
    .select('id')
    .eq('initiative_id', row.id)
    .maybeSingle();

  const { data: items } = checklist
    ? await supabase
        .from('logistics_items')
        .select(
          'id, checklist_id, category, description, position, required, needs_evidence, status, done_by_user_id, done_at, not_applicable_reason'
        )
        .eq('checklist_id', checklist.id)
        .order('position')
    : { data: null };

  return (
    <AppShell user={user} active="/iniciativas">
      <Breadcrumb backHref={`/iniciativas/${row.code}`} backLabel={row.code} code="Logística" />
      <h1 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{row.title}</h1>

      {row.type !== 'EVENT' && (
        <div className="empty" style={{ marginBottom: 20 }}>
          El checklist logístico es parte del ciclo de Eventos — esta iniciativa es de tipo distinto, así que no
          bloquea ninguna transición, pero puedes usarlo igual si te sirve para organizar.
        </div>
      )}

      {!checklist ? (
        <div className="panel">
          <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-2)' }}>
            Todavía no existe un checklist logístico para esta iniciativa.
          </p>
          {isManager ? (
            <CreateChecklistButton initiativeCode={row.code} />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Solo quien gestiona la iniciativa puede crearlo.</p>
          )}
        </div>
      ) : (
        <ChecklistView
          initiativeCode={row.code}
          checklistId={checklist.id}
          items={(items ?? []) as LogisticsItemRow[]}
          isManager={isManager}
        />
      )}
    </AppShell>
  );
}
