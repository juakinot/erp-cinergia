'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { notify, notifyMany } from '@/lib/notifications/notify';
import { getAreaDirectorIds, getPresidentIds } from '@/lib/notifications/recipients';
import type { ProposalStatus } from '@/lib/proposals/types';

export type ActionState = { error: string | null };

export async function createProposal(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const title = String(formData.get('title') ?? '').trim();
  const rationale = String(formData.get('rationale') ?? '').trim();
  const suggestedAction = String(formData.get('suggestedAction') ?? '').trim();
  const affectedAreaIds = formData.getAll('affectedAreaIds').map(String).filter(Boolean);

  if (!title || !rationale || !suggestedAction) {
    return { error: 'Completa título, justificación y acción sugerida.' };
  }
  if (affectedAreaIds.length === 0) {
    return { error: 'Marca al menos un área afectada.' };
  }

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'REPORTS_DIRECTOR') {
    return { error: 'Solo Director de Reportes puede levantar propuestas de mejora.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('improvement_proposals')
    .insert({
      author_user_id: user.id,
      title,
      rationale,
      suggested_action: suggestedAction,
      affected_area_ids: affectedAreaIds,
    })
    .select('id')
    .single();
  if (error || !data) return { error: `No se pudo crear la propuesta: ${error?.message ?? ''}` };

  if (affectedAreaIds.length === 1) {
    const directorIds = await getAreaDirectorIds(supabase, affectedAreaIds[0]);
    await notifyMany(directorIds, {
      category: 'INITIATIVES',
      kind: 'proposal.needs_decision',
      subjectType: 'improvement_proposal',
      subjectId: data.id,
      title: `Propuesta de mejora por decidir: ${title}`,
      linkPath: '/propuestas',
    });
  } else {
    const presidentIds = await getPresidentIds(supabase);
    await notifyMany(presidentIds, {
      category: 'INITIATIVES',
      kind: 'proposal.needs_decision',
      subjectType: 'improvement_proposal',
      subjectId: data.id,
      title: `Propuesta de mejora cross-área por decidir: ${title}`,
      linkPath: '/propuestas',
    });
  }

  revalidatePath('/propuestas');
  return { error: null };
}

export async function decideProposal(
  proposalId: string,
  status: ProposalStatus,
  notes: string
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from('improvement_proposals')
    .select('id, title, author_user_id, status')
    .eq('id', proposalId)
    .maybeSingle();
  if (!proposal) return { error: 'Propuesta no encontrada o sin acceso.' };
  if (proposal.status !== 'PROPOSED') return { error: 'Esta propuesta ya fue decidida.' };

  const { error } = await supabase
    .from('improvement_proposals')
    .update({
      status,
      decided_by_user_id: user.id,
      decided_at: new Date().toISOString(),
      decision_notes: notes.trim() || null,
    })
    .eq('id', proposalId);
  if (error) return { error: error.message };

  if (proposal.author_user_id !== user.id) {
    const verb = status === 'APPROVED' ? 'aprobó' : status === 'REJECTED' ? 'rechazó' : 'marcó como convertida';
    await notify({
      userId: proposal.author_user_id,
      category: 'INITIATIVES',
      kind: 'proposal.decided',
      subjectType: 'improvement_proposal',
      subjectId: proposalId,
      title: `Se ${verb} tu propuesta: ${proposal.title}`,
      body: notes.trim() || undefined,
      linkPath: '/propuestas',
    });
  }

  revalidatePath('/propuestas');
  return { error: null };
}
