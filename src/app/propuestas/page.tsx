import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { PROPOSAL_STATUS_BADGE, PROPOSAL_STATUS_LABELS, type ImprovementProposalRow } from '@/lib/proposals/types';
import { NewProposalForm } from './new-proposal-form';
import { DecideProposalActions } from './decide-proposal-actions';

function personName(field: ImprovementProposalRow['author']) {
  const p = Array.isArray(field) ? field[0] : field;
  return p?.full_name ?? '—';
}

export default async function ProposalsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: areas } = await supabase.from('areas').select('id, name').order('name');
  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name]));

  const { data } = await supabase
    .from('improvement_proposals')
    .select(
      'id, author_user_id, title, rationale, suggested_action, status, affected_area_ids, decided_by_user_id, decided_at, decision_notes, created_at, author:author_user_id(full_name), decided_by:decided_by_user_id(full_name)'
    )
    .order('created_at', { ascending: false });

  const proposals = (data ?? []) as unknown as ImprovementProposalRow[];

  const canCreate = user.role === 'REPORTS_DIRECTOR';

  return (
    <AppShell user={user} active="/propuestas">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Propuestas de mejora</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            El canal formal para levantar un cambio a partir de una tendencia observada en los datos agregados — no
            para reportar un problema puntual de una iniciativa.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {canCreate && <NewProposalForm areas={areas ?? []} />}

        {proposals.length === 0 ? (
          <div className="empty">No hay propuestas todavía.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {proposals.map((p) => {
              const isSingleArea = p.affected_area_ids.length === 1;
              const canDecide =
                p.status === 'PROPOSED' &&
                (user.role === 'PRESIDENT' || (user.role === 'AREA_DIRECTOR' && isSingleArea && user.areaId === p.affected_area_ids[0]));

              return (
                <div key={p.id} className="panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{p.title}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
                        {personName(p.author)} ·{' '}
                        {p.affected_area_ids.map((id) => areaNameById.get(id) ?? '—').join(', ')}
                      </p>
                    </div>
                    <span className={`badge ${PROPOSAL_STATUS_BADGE[p.status]}`}>
                      {PROPOSAL_STATUS_LABELS[p.status]}
                    </span>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-1)' }}>
                      <strong>Justificación:</strong> {p.rationale}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-1)' }}>
                      <strong>Acción sugerida:</strong> {p.suggested_action}
                    </p>
                    {p.decision_notes && (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)' }}>
                        <strong>Notas de decisión ({personName(p.decided_by)}):</strong> {p.decision_notes}
                      </p>
                    )}
                  </div>

                  {canDecide && <DecideProposalActions proposalId={p.id} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
