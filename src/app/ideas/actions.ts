'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { notify, notifyMany } from '@/lib/notifications/notify';
import { toLimaInstant } from '@/lib/time';

type Modality = 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';

export type ActionState = { error: string | null };

const MAX_CAMPAIGN_DAYS = 3;
const MIN_GAP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function createCampaign(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const opensAtRaw = String(formData.get('opensAt') ?? '');
  const closesAtRaw = String(formData.get('closesAt') ?? '');
  const voteThreshold = Number(formData.get('voteThreshold') ?? 5);

  if (!title || !opensAtRaw || !closesAtRaw) return { error: 'Completa título, apertura y cierre.' };

  const opensAt = toLimaInstant(opensAtRaw);
  const closesAt = toLimaInstant(closesAtRaw);
  const opens = new Date(opensAt);
  const closes = new Date(closesAt);
  if (closes <= opens) return { error: 'El cierre debe ser después de la apertura.' };
  if (closes.getTime() - opens.getTime() > MAX_CAMPAIGN_DAYS * DAY_MS) {
    return { error: `Una campaña dura como máximo ${MAX_CAMPAIGN_DAYS} días.` };
  }

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'PRESIDENT') return { error: 'Solo Presidencia puede crear una campaña de ideación.' };

  const supabase = await createClient();

  const { data: lastCampaign } = await supabase
    .from('idea_campaigns')
    .select('closes_at')
    .order('closes_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastCampaign) {
    const gapMs = opens.getTime() - new Date(lastCampaign.closes_at).getTime();
    if (gapMs < MIN_GAP_DAYS * DAY_MS) {
      return { error: `Deben pasar al menos ${MIN_GAP_DAYS} días desde el cierre de la última campaña.` };
    }
  }

  const { data: campaign, error } = await supabase
    .from('idea_campaigns')
    .insert({
      title,
      description: description || null,
      opens_at: opensAt,
      closes_at: closesAt,
      vote_threshold: voteThreshold || 5,
      created_by_user_id: user.id,
    })
    .select('id')
    .single();
  if (error || !campaign) return { error: `No se pudo crear la campaña: ${error?.message ?? ''}` };

  revalidatePath('/ideas');
  return { error: null };
}

/**
 * Nada en esta app transiciona estados por temporizador — cada módulo con
 * un ciclo de vida (Encuestas, Actas) lo hace con un botón explícito, no
 * con un cron implícito. `idea_campaigns.status` no es la excepción:
 * arranca en SCHEDULED y `ideas_insert` en RLS exige literalmente
 * status = 'ACTIVE' en la fila — sin este paso, nadie podría proponer
 * una idea nunca, sin importar si `opens_at` ya pasó.
 */
export async function activateCampaign(campaignId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'PRESIDENT') return { error: 'Solo Presidencia puede activar la campaña.' };

  const supabase = await createClient();
  const { data: campaign, error } = await supabase
    .from('idea_campaigns')
    .update({ status: 'ACTIVE' })
    .eq('id', campaignId)
    .eq('status', 'SCHEDULED')
    .select('title')
    .single();
  if (error || !campaign) return { error: error?.message ?? 'No se pudo activar la campaña.' };

  const { data: directors } = await supabase.from('users').select('id').eq('role', 'AREA_DIRECTOR');
  await notifyMany((directors ?? []).map((d) => d.id) as string[], {
    category: 'INITIATIVES',
    kind: 'idea_campaign.opened',
    subjectType: 'idea_campaign',
    subjectId: campaignId,
    title: `Campaña de ideación activa: ${campaign.title}`,
    linkPath: '/ideas',
  });

  revalidatePath('/ideas');
  return { error: null };
}

export async function closeCampaign(campaignId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'PRESIDENT') return { error: 'Solo Presidencia puede cerrar la campaña.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('idea_campaigns')
    .update({ status: 'CLOSED' })
    .eq('id', campaignId)
    .eq('status', 'ACTIVE');
  if (error) return { error: error.message };

  revalidatePath('/ideas');
  return { error: null };
}

export async function createIdea(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const areaId = String(formData.get('areaId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const objective = String(formData.get('objective') ?? '').trim();
  const modality = String(formData.get('modality') ?? 'IN_PERSON') as Modality;

  if (!areaId || !title || !description || !objective) return { error: 'Completa todos los campos.' };

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { error } = await supabase.from('ideas').insert({
    campaign_id: campaignId,
    area_id: areaId,
    author_user_id: user.id,
    title,
    description,
    objective,
    modality,
  });
  if (error) return { error: `No se pudo guardar la idea: ${error.message}` };

  revalidatePath('/ideas');
  return { error: null };
}

export async function publishIdea(ideaId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { error } = await supabase
    .from('ideas')
    .update({ status: 'ACTIVE' })
    .eq('id', ideaId)
    .eq('author_user_id', user.id)
    .eq('status', 'DRAFT');
  if (error) return { error: error.message };

  revalidatePath('/ideas');
  return { error: null };
}

export async function toggleVote(ideaId: string, currentlyVoted: boolean): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  if (currentlyVoted) {
    const { error } = await supabase.from('idea_votes').delete().eq('idea_id', ideaId).eq('user_id', user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('idea_votes').insert({ idea_id: ideaId, user_id: user.id });
    if (error) return { error: error.code === '23505' ? 'Ya votaste esta idea.' : error.message };
  }

  revalidatePath('/ideas');
  return { error: null };
}

function canDecideIdea(actor: { role: string; areaId: string | null }, ideaAreaId: string) {
  if (actor.role === 'PRESIDENT') return true;
  return actor.role === 'AREA_DIRECTOR' && actor.areaId === ideaAreaId;
}

export async function discardIdea(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const ideaId = String(formData.get('ideaId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) return { error: 'Indica el motivo del descarte.' };

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, area_id, status, author_user_id, title')
    .eq('id', ideaId)
    .maybeSingle();
  if (!idea) return { error: 'Idea no encontrada o sin acceso.' };
  if (!canDecideIdea({ role: user.role, areaId: user.areaId }, idea.area_id)) {
    return { error: 'Descartar una idea es autoridad del Director de esa área o Presidencia.' };
  }
  if (idea.status !== 'ACTIVE') return { error: 'Solo se puede descartar una idea activa.' };

  const { error } = await supabase
    .from('ideas')
    .update({ status: 'DISCARDED', discarded_reason: reason })
    .eq('id', ideaId);
  if (error) return { error: error.message };

  if (idea.author_user_id !== user.id) {
    await notify({
      userId: idea.author_user_id,
      category: 'INITIATIVES',
      kind: 'idea.discarded',
      subjectType: 'idea',
      subjectId: ideaId,
      title: `Se descartó tu idea: ${idea.title}`,
      body: reason,
      linkPath: '/ideas',
    });
  }

  revalidatePath('/ideas');
  return { error: null };
}

export async function promoteIdea(ideaId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, area_id, status, author_user_id, title, description, objective, modality')
    .eq('id', ideaId)
    .maybeSingle();
  if (!idea) return { error: 'Idea no encontrada o sin acceso.' };
  if (!canDecideIdea({ role: user.role, areaId: user.areaId }, idea.area_id)) {
    return { error: 'Promover una idea es autoridad del Director de esa área o Presidencia.' };
  }
  if (idea.status !== 'ACTIVE') return { error: 'Solo se puede promover una idea activa.' };

  const { data: area } = await supabase
    .from('areas')
    .select('default_initiative_type')
    .eq('id', idea.area_id)
    .maybeSingle();
  if (!area) return { error: 'Área no encontrada.' };

  const type = area.default_initiative_type as 'EVENT' | 'CAMPAIGN' | 'PROJECT';
  const prefix = { EVENT: 'EV', CAMPAIGN: 'CM', PROJECT: 'PY' }[type];
  const year = new Date().getFullYear();

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: maxRow } = await supabase
      .from('initiatives')
      .select('sequence')
      .eq('type', type)
      .eq('year', year)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle();
    const sequence = (maxRow?.sequence ?? 0) + 1;
    const code = `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;

    const { data: created, error } = await supabase
      .from('initiatives')
      .insert({
        code,
        year,
        sequence,
        type,
        area_id: idea.area_id,
        title: idea.title,
        description: idea.description,
        objective: idea.objective,
        modality: idea.modality,
        coordinator_user_id: user.id,
        created_by_user_id: user.id,
        source_idea_id: ideaId,
      })
      .select('id, code')
      .single();

    if (!error && created) {
      await supabase.from('ideas').update({ status: 'PROMOTED' }).eq('id', ideaId);
      if (idea.author_user_id !== user.id) {
        await notify({
          userId: idea.author_user_id,
          category: 'INITIATIVES',
          kind: 'idea.promoted',
          subjectType: 'idea',
          subjectId: ideaId,
          title: `Tu idea se promovió a iniciativa ${created.code}`,
          linkPath: `/iniciativas/${created.code}`,
        });
      }
      revalidatePath('/ideas');
      return { error: null };
    }

    lastError = error?.message ?? 'Error desconocido';
    if (error?.code !== '23505') break;
  }

  return { error: `No se pudo promover la idea: ${lastError}` };
}
