import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import type { IdeaCampaignRow, IdeaRow } from '@/lib/ideas/types';
import { LIMA_TZ } from '@/lib/time';
import { CreateCampaignForm } from './create-campaign-form';
import { CampaignLifecycleButton } from './campaign-lifecycle-button';
import { NewIdeaForm } from './new-idea-form';
import { IdeaCard } from './idea-card';

export default async function IdeasPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: campaignData } = await supabase
    .from('idea_campaigns')
    .select('id, title, description, status, opens_at, closes_at, vote_threshold')
    .order('opens_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const campaign = campaignData as IdeaCampaignRow | null;
  const isActive = campaign?.status === 'ACTIVE';

  const { data: areas } = await supabase.from('areas').select('id, name').order('name');

  let ideas: IdeaRow[] = [];
  if (campaign) {
    const { data } = await supabase
      .from('ideas')
      .select(
        'id, campaign_id, area_id, author_user_id, title, description, objective, modality, status, discarded_reason, created_at, author:author_user_id(full_name), areas(name), idea_votes(user_id)'
      )
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false });

    ideas = ((data ?? []) as unknown as Array<IdeaRow & { idea_votes: { user_id: string }[] }>).map((i) => {
      const votes = i.idea_votes ?? [];
      return { ...i, vote_count: votes.length, voted_by_me: votes.some((v) => v.user_id === user.id) };
    });
  }

  const myDrafts = ideas.filter((i) => i.status === 'DRAFT' && i.author_user_id === user.id);
  const activeIdeas = ideas
    .filter((i) => i.status === 'ACTIVE')
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
  const resolvedIdeas = ideas.filter((i) => i.status === 'PROMOTED' || i.status === 'DISCARDED');

  return (
    <AppShell user={user} active="/ideas">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Ideación</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            Campañas periódicas para proponer y votar ideas de nuevas iniciativas.
          </p>
        </div>
      </div>

      {!campaign || campaign.status === 'CLOSED' ? (
        <div className="flex flex-col gap-4">
          {campaign && (
            <div className="empty">Última campaña ({campaign.title}) cerrada — sin campaña activa por ahora.</div>
          )}
          {!campaign && <div className="empty">Todavía no hubo ninguna campaña de ideación.</div>}
          {user.role === 'PRESIDENT' && <CreateCampaignForm />}
        </div>
      ) : !isActive ? (
        <div className="flex flex-col gap-3">
          <div className="empty">
            Campaña programada: {campaign.title} — abre el{' '}
            {new Date(campaign.opens_at).toLocaleDateString('es-PE', { timeZone: LIMA_TZ })}.
          </div>
          {user.role === 'PRESIDENT' && <CampaignLifecycleButton campaignId={campaign.id} action="activate" />}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="panel">
            <div className="panel-head">
              <span>{campaign.title}</span>
              <span className="badge b-verde">Activa</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {campaign.description || 'Sin descripción.'} · Cierra el{' '}
              {new Date(campaign.closes_at).toLocaleString('es-PE', { timeZone: LIMA_TZ })} · Umbral de votos:{' '}
              {campaign.vote_threshold}
            </p>
            {user.role === 'PRESIDENT' && (
              <div style={{ marginTop: 10 }}>
                <CampaignLifecycleButton campaignId={campaign.id} action="close" />
              </div>
            )}
          </div>

          <NewIdeaForm campaignId={campaign.id} areas={areas ?? []} />

          {myDrafts.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                Mis borradores (solo tú los ves)
              </h3>
              <div className="flex flex-col gap-2">
                {myDrafts.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} currentUserId={user.id} userRole={user.role} userAreaId={user.areaId} voteThreshold={campaign.vote_threshold} />
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
              Ideas activas ({activeIdeas.length})
            </h3>
            {activeIdeas.length === 0 ? (
              <div className="empty">Todavía no hay ideas publicadas.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {activeIdeas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} currentUserId={user.id} userRole={user.role} userAreaId={user.areaId} voteThreshold={campaign.vote_threshold} />
                ))}
              </div>
            )}
          </div>

          {resolvedIdeas.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Resueltas</h3>
              <div className="flex flex-col gap-2">
                {resolvedIdeas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} currentUserId={user.id} userRole={user.role} userAreaId={user.areaId} voteThreshold={campaign.vote_threshold} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
