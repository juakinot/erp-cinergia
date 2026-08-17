import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canManageInitiative } from '@/lib/initiatives/permissions';
import { missingRequiredFields } from '@/lib/actas/autofill';
import { ACTA_TEMPLATES } from '@/lib/actas/templates';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';
import { CreateActaButton } from './create-acta-button';
import { ActaForm } from './acta-form';

export default async function ActaPage({ params }: { params: Promise<{ code: string }> }) {
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

  const template = ACTA_TEMPLATES.find((t) => t.initiativeType === row.type);

  const { data: acta } = await supabase
    .from('actas')
    .select(
      'id, status, input_data, version, reviewed_at, reviewer:reviewed_by_user_id(full_name), approved_at, approver:approved_by_user_id(full_name), presidency_approved_at, presidency_approver:presidency_approved_by_user_id(full_name), published_at'
    )
    .eq('initiative_id', row.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const missingCount = template && acta ? missingRequiredFields(template, acta.input_data as Record<string, unknown>).length : 0;

  return (
    <AppShell user={user} active="/iniciativas">
      <Breadcrumb backHref={`/iniciativas/${row.code}`} backLabel={row.code} code="Acta" />
      <h1 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{row.title}</h1>

      {!template && (
        <div className="empty">No hay plantilla de acta definida para el tipo &quot;{row.type}&quot;.</div>
      )}

      {template && !acta && (
        <div className="panel">
          <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-2)' }}>
            Todavía no existe un acta para esta iniciativa — <strong style={{ color: 'var(--text-1)' }}>{template.name}</strong>.
          </p>
          {isManager ? (
            <CreateActaButton initiativeCode={row.code} />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Solo quien gestiona la iniciativa puede crearla.</p>
          )}
        </div>
      )}

      {template && acta && (
        <ActaForm
          initiativeCode={row.code}
          template={template}
          acta={acta as unknown as Parameters<typeof ActaForm>[0]['acta']}
          isManager={isManager}
          actorRole={user.role}
          missingCount={missingCount}
        />
      )}
    </AppShell>
  );
}
