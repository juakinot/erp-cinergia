import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { INPUT_KIND_LABELS, INPUT_STATUS_BADGE, INPUT_STATUS_LABELS, type InitiativeInputRow } from '@/lib/radar/types';
import { PRIORITY_LABELS, PRIORITY_STYLES } from '@/lib/tasks/types';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';
import { ProposeInputForm } from './propose-input-form';

export default async function RadarPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('id, code, title, area_id, coordinator_user_id')
    .eq('code', code)
    .maybeSingle();

  if (!initiative) notFound();

  const row = initiative as {
    id: string;
    code: string;
    title: string;
    area_id: string;
    coordinator_user_id: string;
  };

  const { data: inputs } = await supabase
    .from('initiative_inputs')
    .select(
      'id, initiative_id, author_user_id, kind, title, description, priority, status, reviewed_by_user_id, reviewed_at, review_notes, duplicate_of_id, converted_to_type, converted_to_id, converted_by_user_id, converted_at, rejected_reason, created_at, author:author_user_id(full_name)'
    )
    .eq('initiative_id', row.id)
    .order('created_at', { ascending: false });

  const rows = (inputs ?? []) as unknown as InitiativeInputRow[];
  const pending = rows.filter((i) => i.status === 'PROPOSED' || i.status === 'IN_REVIEW');
  const resolved = rows.filter((i) => i.status !== 'PROPOSED' && i.status !== 'IN_REVIEW');

  function authorName(input: InitiativeInputRow) {
    const a = Array.isArray(input.author) ? input.author[0] : input.author;
    return a?.full_name ?? '—';
  }

  return (
    <AppShell user={user} active="/iniciativas">
      <Breadcrumb backHref={`/iniciativas/${row.code}`} backLabel={row.code} code="Radar operativo" />
      <h1 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{row.title}</h1>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 20 }}>
        <div className={`kpi ${pending.length > 0 ? 'warn' : ''}`}>
          <div className="k-label">Pendientes de acción</div>
          <div className="k-value">{pending.length}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Total propuestos</div>
          <div className="k-value">{rows.length}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Convertidos</div>
          <div className="k-value">{rows.filter((i) => i.status === 'CONVERTED').length}</div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <ProposeInputForm initiativeCode={row.code} />

        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            Pendientes de acción
          </h3>
          {pending.length === 0 ? (
            <div className="empty">Nada pendiente por ahora.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {pending.map((input) => (
                <InputCard key={input.id} input={input} initiativeCode={row.code} authorName={authorName(input)} />
              ))}
            </div>
          )}
        </div>

        {resolved.length > 0 && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Resueltos</h3>
            <div className="flex flex-col gap-2">
              {resolved.map((input) => (
                <InputCard key={input.id} input={input} initiativeCode={row.code} authorName={authorName(input)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function InputCard({
  input,
  initiativeCode,
  authorName,
}: {
  input: InitiativeInputRow;
  initiativeCode: string;
  authorName: string;
}) {
  return (
    <Link
      href={`/iniciativas/${initiativeCode}/radar/${input.id}`}
      className="panel"
      style={{ padding: 12, display: 'block', textDecoration: 'none' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{input.title}</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-2)' }}>
            {INPUT_KIND_LABELS[input.kind]} · {authorName}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <span className={`badge ${PRIORITY_STYLES[input.priority]}`}>{PRIORITY_LABELS[input.priority]}</span>
          <span className={`badge ${INPUT_STATUS_BADGE[input.status]}`}>{INPUT_STATUS_LABELS[input.status]}</span>
        </div>
      </div>
    </Link>
  );
}
