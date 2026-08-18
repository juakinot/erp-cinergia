'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canManageInitiative } from '@/lib/initiatives/permissions';
import type { LogisticsItemStatus } from '@/lib/logistics/types';

export type ActionState = { error: string | null };

async function fetchInitiativeForLogistics(supabase: Awaited<ReturnType<typeof createClient>>, code: string) {
  const { data, error } = await supabase
    .from('initiatives')
    .select('id, code, type, area_id, coordinator_user_id')
    .eq('code', code)
    .maybeSingle();
  if (error || !data) throw new Error('Iniciativa no encontrada o sin acceso.');
  return data;
}

async function requireManager(code: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiativeForLogistics(supabase, code);
  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  if (!canManageInitiative(actor, initiative)) {
    throw new Error('No tienes autoridad para gestionar la logística de esta iniciativa.');
  }
  return { supabase, initiative, user };
}

export async function createChecklist(code: string): Promise<ActionState> {
  try {
    const { supabase, initiative } = await requireManager(code);
    const { error } = await supabase.from('logistics_checklists').insert({ initiative_id: initiative.id });
    if (error) return { error: `No se pudo crear el checklist: ${error.message}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/logistica`);
  return { error: null };
}

export async function addItem(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const checklistId = String(formData.get('checklistId') ?? '');
  const category = String(formData.get('category') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const required = formData.get('required') === 'on';
  const needsEvidence = formData.get('needsEvidence') === 'on';

  if (!category || !description) return { error: 'Completa categoría y descripción.' };

  try {
    const { supabase } = await requireManager(code);

    const { count } = await supabase
      .from('logistics_items')
      .select('id', { count: 'exact', head: true })
      .eq('checklist_id', checklistId);

    const { error } = await supabase.from('logistics_items').insert({
      checklist_id: checklistId,
      category,
      description,
      position: count ?? 0,
      required,
      needs_evidence: needsEvidence,
    });
    if (error) return { error: `No se pudo agregar el ítem: ${error.message}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/logistica`);
  return { error: null };
}

export async function setItemStatus(
  code: string,
  itemId: string,
  status: LogisticsItemStatus,
  notApplicableReason?: string
): Promise<ActionState> {
  if (status === 'NOT_APPLICABLE' && !notApplicableReason?.trim()) {
    return { error: 'Marcar un ítem como "No aplica" requiere indicar el motivo.' };
  }

  try {
    const { supabase, user } = await requireManager(code);

    const patch: Record<string, unknown> = { status };
    patch.done_by_user_id = status === 'DONE' ? user.id : null;
    patch.done_at = status === 'DONE' ? new Date().toISOString() : null;
    patch.not_applicable_reason = status === 'NOT_APPLICABLE' ? notApplicableReason!.trim() : null;

    const { error } = await supabase.from('logistics_items').update(patch).eq('id', itemId);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/logistica`);
  revalidatePath(`/iniciativas/${code}`);
  return { error: null };
}

export async function deleteItem(code: string, itemId: string): Promise<ActionState> {
  try {
    const { supabase } = await requireManager(code);
    const { error } = await supabase.from('logistics_items').delete().eq('id', itemId);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/logistica`);
  revalidatePath(`/iniciativas/${code}`);
  return { error: null };
}
