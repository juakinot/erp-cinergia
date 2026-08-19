'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CONVERTED_TO_LABELS, type ConvertedToType, type InputKind, type InputStatus } from '@/lib/radar/types';
import type { TaskPriority } from '@/lib/tasks/types';
import { notify, notifyMany } from '@/lib/notifications/notify';
import { getAreaDirectorIds } from '@/lib/notifications/recipients';

export type ActionState = { error: string | null };

async function fetchInitiativeForRadar(supabase: Awaited<ReturnType<typeof createClient>>, code: string) {
  const { data, error } = await supabase
    .from('initiatives')
    .select('id, code, area_id, coordinator_user_id')
    .eq('code', code)
    .maybeSingle();
  if (error || !data) throw new Error('Iniciativa no encontrada o sin acceso.');
  return data;
}

async function requireSession(code: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const initiative = await fetchInitiativeForRadar(supabase, code);
  return { supabase, initiative, user };
}

function isTriager(role: string) {
  return role === 'COORDINATOR' || role === 'AREA_DIRECTOR' || role === 'PRESIDENT';
}

/**
 * Aprobar y convertir un input del Radar es autoridad de Dirección, no de
 * Coordinación: el Coordinador prevalida (PROPOSED → IN_REVIEW) y ahí se
 * detiene. Deliberadamente NO se usa `canManageInitiative` acá, aunque el
 * resto de módulos sí lo haga — esa función incluye al Coordinador de la
 * iniciativa, y para el Radar eso rompería la separación de autoridad que
 * el esquema declara ("Conversión: solo Director de Área o Presidencia")
 * y que las políticas RLS delegan explícitamente a esta capa de servicio.
 */
function canApproveInput(
  actor: { id: string; role: string; areaId: string | null },
  initiative: { area_id: string }
) {
  if (actor.role === 'PRESIDENT') return true;
  return actor.role === 'AREA_DIRECTOR' && actor.areaId === initiative.area_id;
}

async function fetchInput(supabase: Awaited<ReturnType<typeof createClient>>, inputId: string) {
  const { data, error } = await supabase
    .from('initiative_inputs')
    .select('id, initiative_id, status, title, description, kind, priority, author_user_id')
    .eq('id', inputId)
    .maybeSingle();
  if (error || !data) throw new Error('Input no encontrado o sin acceso.');
  return data;
}

export async function proposeInput(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const kind = String(formData.get('kind') ?? '') as InputKind;
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const priority = String(formData.get('priority') ?? 'MEDIUM') as TaskPriority;

  if (!title || !description) return { error: 'Completa título y descripción.' };

  try {
    const { supabase, initiative, user } = await requireSession(code);
    const { error } = await supabase.from('initiative_inputs').insert({
      initiative_id: initiative.id,
      author_user_id: user.id,
      kind,
      title,
      description,
      priority,
      status: 'PROPOSED',
    });
    if (error) return { error: `No se pudo registrar el input: ${error.message}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/radar`);
  return { error: null };
}

async function logTransition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inputId: string,
  fromStatus: InputStatus | null,
  toStatus: InputStatus,
  actorUserId: string,
  notes?: string | null
) {
  await supabase.from('initiative_input_transitions').insert({
    input_id: inputId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_user_id: actorUserId,
    notes: notes ?? null,
  });
}

export async function triageInput(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const inputId = String(formData.get('inputId') ?? '');
  const kind = String(formData.get('kind') ?? '') as InputKind;
  const notes = String(formData.get('notes') ?? '').trim();
  const duplicateOfId = String(formData.get('duplicateOfId') ?? '').trim() || null;

  try {
    const { supabase, initiative, user } = await requireSession(code);
    if (!isTriager(user.role)) return { error: 'Solo Coordinador o superior puede prevalidar un input.' };

    const input = await fetchInput(supabase, inputId);
    if (input.status !== 'PROPOSED') return { error: 'Solo se puede prevalidar un input recién propuesto.' };

    const { error } = await supabase
      .from('initiative_inputs')
      .update({
        kind,
        status: 'IN_REVIEW',
        reviewed_by_user_id: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        duplicate_of_id: duplicateOfId,
      })
      .eq('id', inputId);
    if (error) return { error: error.message };

    await logTransition(supabase, inputId, 'PROPOSED', 'IN_REVIEW', user.id, notes || null);

    const directorIds = (await getAreaDirectorIds(supabase, initiative.area_id)).filter((id) => id !== user.id);
    await notifyMany(directorIds, {
      category: 'RADAR',
      kind: 'radar.needs_approval',
      subjectType: 'initiative_input',
      subjectId: inputId,
      title: `Input del Radar listo para tu decisión: ${input.title}`,
      linkPath: '/aprobaciones',
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/radar`);
  revalidatePath(`/iniciativas/${code}/radar/${inputId}`);
  return { error: null };
}

export async function approveInput(code: string, inputId: string): Promise<ActionState> {
  try {
    const { supabase, initiative, user } = await requireSession(code);
    const actor = { id: user.id, role: user.role, areaId: user.areaId };
    if (!canApproveInput(actor, initiative)) {
      return { error: 'Aprobar un input es autoridad del Director de Área o Presidencia.' };
    }

    const input = await fetchInput(supabase, inputId);
    if (input.status !== 'PROPOSED' && input.status !== 'IN_REVIEW') {
      return { error: 'Este input ya fue resuelto.' };
    }

    const patch: Record<string, unknown> = { status: 'APPROVED' };
    if (input.status === 'PROPOSED') {
      patch.reviewed_by_user_id = user.id;
      patch.reviewed_at = new Date().toISOString();
    }

    const { error } = await supabase.from('initiative_inputs').update(patch).eq('id', inputId);
    if (error) return { error: error.message };

    await logTransition(supabase, inputId, input.status, 'APPROVED', user.id);

    if (input.author_user_id !== user.id) {
      await notify({
        userId: input.author_user_id,
        category: 'RADAR',
        kind: 'radar.approved',
        subjectType: 'initiative_input',
        subjectId: inputId,
        title: `Se aprobó tu input del Radar: ${input.title}`,
        linkPath: `/iniciativas/${code}/radar/${inputId}`,
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/radar`);
  revalidatePath(`/iniciativas/${code}/radar/${inputId}`);
  return { error: null };
}

export async function rejectInput(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const inputId = String(formData.get('inputId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (!reason) return { error: 'Indica el motivo del rechazo.' };

  try {
    const { supabase, initiative, user } = await requireSession(code);
    const actor = { id: user.id, role: user.role, areaId: user.areaId };
    if (!canApproveInput(actor, initiative)) {
      return { error: 'Rechazar un input es autoridad del Director de Área o Presidencia.' };
    }

    const input = await fetchInput(supabase, inputId);
    if (input.status !== 'PROPOSED' && input.status !== 'IN_REVIEW') {
      return { error: 'Este input ya fue resuelto.' };
    }

    const { error } = await supabase
      .from('initiative_inputs')
      .update({ status: 'REJECTED', rejected_reason: reason })
      .eq('id', inputId);
    if (error) return { error: error.message };

    await logTransition(supabase, inputId, input.status, 'REJECTED', user.id, reason);

    if (input.author_user_id !== user.id) {
      await notify({
        userId: input.author_user_id,
        category: 'RADAR',
        kind: 'radar.rejected',
        subjectType: 'initiative_input',
        subjectId: inputId,
        title: `Se rechazó tu input del Radar: ${input.title}`,
        body: reason,
        linkPath: `/iniciativas/${code}/radar/${inputId}`,
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/radar`);
  revalidatePath(`/iniciativas/${code}/radar/${inputId}`);
  return { error: null };
}

async function markConverted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  code: string,
  input: { id: string; title: string; author_user_id: string },
  fromStatus: InputStatus,
  convertedToType: ConvertedToType,
  convertedToId: string,
  userId: string
) {
  await supabase
    .from('initiative_inputs')
    .update({
      status: 'CONVERTED',
      converted_to_type: convertedToType,
      converted_to_id: convertedToId,
      converted_by_user_id: userId,
      converted_at: new Date().toISOString(),
    })
    .eq('id', input.id);
  await logTransition(supabase, input.id, fromStatus, 'CONVERTED', userId);

  if (input.author_user_id !== userId) {
    await notify({
      userId: input.author_user_id,
      category: 'RADAR',
      kind: 'radar.converted',
      subjectType: 'initiative_input',
      subjectId: input.id,
      title: `Tu input del Radar se convirtió en ${CONVERTED_TO_LABELS[convertedToType]}: ${input.title}`,
      linkPath: `/iniciativas/${code}/radar/${input.id}`,
    });
  }
}

export async function convertToTask(code: string, inputId: string): Promise<ActionState> {
  try {
    const { supabase, initiative, user } = await requireSession(code);
    const actor = { id: user.id, role: user.role, areaId: user.areaId };
    if (!canApproveInput(actor, initiative)) return { error: 'Convertir un input es autoridad del Director de Área o Presidencia.' };

    const input = await fetchInput(supabase, inputId);
    if (input.status !== 'PROPOSED' && input.status !== 'IN_REVIEW' && input.status !== 'APPROVED') {
      return { error: 'Este input ya fue resuelto.' };
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        initiative_id: initiative.id,
        title: input.title,
        description: input.description,
        priority: input.priority,
        created_by_user_id: user.id,
        requires_approval: input.priority === 'HIGH' || input.priority === 'CRITICAL',
        source_input_id: inputId,
      })
      .select('id')
      .single();
    if (taskError || !task) return { error: `No se pudo crear la tarea: ${taskError?.message ?? ''}` };

    const { data: board } = await supabase
      .from('kanban_boards')
      .select('id')
      .eq('initiative_id', initiative.id)
      .maybeSingle();
    if (board) {
      const { data: column } = await supabase
        .from('kanban_columns')
        .select('id')
        .eq('board_id', board.id)
        .eq('status', 'PENDING')
        .maybeSingle();
      if (column) {
        const { count } = await supabase
          .from('kanban_cards')
          .select('id', { count: 'exact', head: true })
          .eq('column_id', column.id);
        await supabase.from('kanban_cards').insert({ column_id: column.id, task_id: task.id, position: count ?? 0 });
      }
    }
    await supabase.from('task_transitions').insert({
      task_id: task.id,
      from_status: null,
      to_status: 'PENDING',
      actor_user_id: user.id,
    });

    await markConverted(supabase, code, input, input.status, 'TASK', task.id, user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/radar`);
  revalidatePath(`/iniciativas/${code}/radar/${inputId}`);
  revalidatePath(`/iniciativas/${code}/tareas`);
  return { error: null };
}

export async function convertToRisk(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const inputId = String(formData.get('inputId') ?? '');
  const likelihood = String(formData.get('likelihood') ?? '');
  const impact = String(formData.get('impact') ?? '');
  const mitigationPlan = String(formData.get('mitigationPlan') ?? '').trim();

  if (!likelihood || !impact) return { error: 'Indica probabilidad e impacto.' };

  try {
    const { supabase, initiative, user } = await requireSession(code);
    const actor = { id: user.id, role: user.role, areaId: user.areaId };
    if (!canApproveInput(actor, initiative)) return { error: 'Convertir un input es autoridad del Director de Área o Presidencia.' };

    const input = await fetchInput(supabase, inputId);
    if (input.status !== 'PROPOSED' && input.status !== 'IN_REVIEW' && input.status !== 'APPROVED') {
      return { error: 'Este input ya fue resuelto.' };
    }

    const { data: risk, error: riskError } = await supabase
      .from('initiative_risks')
      .insert({
        initiative_id: initiative.id,
        title: input.title,
        description: input.description,
        likelihood,
        impact,
        mitigation_plan: mitigationPlan || null,
        source_input_id: inputId,
      })
      .select('id')
      .single();
    if (riskError || !risk) return { error: `No se pudo crear el riesgo: ${riskError?.message ?? ''}` };

    await markConverted(supabase, code, input, input.status, 'RISK', risk.id, user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/radar`);
  revalidatePath(`/iniciativas/${code}/radar/${inputId}`);
  return { error: null };
}

export async function convertToObservation(code: string, inputId: string): Promise<ActionState> {
  try {
    const { supabase, initiative, user } = await requireSession(code);
    const actor = { id: user.id, role: user.role, areaId: user.areaId };
    if (!canApproveInput(actor, initiative)) return { error: 'Convertir un input es autoridad del Director de Área o Presidencia.' };

    const input = await fetchInput(supabase, inputId);
    if (input.status !== 'PROPOSED' && input.status !== 'IN_REVIEW' && input.status !== 'APPROVED') {
      return { error: 'Este input ya fue resuelto.' };
    }

    const { data: obs, error: obsError } = await supabase
      .from('observations')
      .insert({
        initiative_id: initiative.id,
        author_user_id: user.id,
        body: `${input.title}\n\n${input.description}`,
        visibility: 'INTERNAL',
        source_input_id: inputId,
      })
      .select('id')
      .single();
    if (obsError || !obs) return { error: `No se pudo crear la observación: ${obsError?.message ?? ''}` };

    await markConverted(supabase, code, input, input.status, 'OBSERVATION', obs.id, user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/radar`);
  revalidatePath(`/iniciativas/${code}/radar/${inputId}`);
  return { error: null };
}

export async function convertToLogisticsItem(code: string, inputId: string): Promise<ActionState> {
  try {
    const { supabase, initiative, user } = await requireSession(code);
    const actor = { id: user.id, role: user.role, areaId: user.areaId };
    if (!canApproveInput(actor, initiative)) return { error: 'Convertir un input es autoridad del Director de Área o Presidencia.' };

    const input = await fetchInput(supabase, inputId);
    if (input.status !== 'PROPOSED' && input.status !== 'IN_REVIEW' && input.status !== 'APPROVED') {
      return { error: 'Este input ya fue resuelto.' };
    }

    const { data: checklist } = await supabase
      .from('logistics_checklists')
      .select('id')
      .eq('initiative_id', initiative.id)
      .maybeSingle();
    if (!checklist) {
      return { error: 'Esta iniciativa todavía no tiene un checklist logístico — créalo primero desde Logística.' };
    }

    const { count } = await supabase
      .from('logistics_items')
      .select('id', { count: 'exact', head: true })
      .eq('checklist_id', checklist.id);

    const { data: item, error: itemError } = await supabase
      .from('logistics_items')
      .insert({
        checklist_id: checklist.id,
        category: 'General',
        description: `${input.title} — ${input.description}`,
        position: count ?? 0,
        required: input.priority === 'HIGH' || input.priority === 'CRITICAL',
      })
      .select('id')
      .single();
    if (itemError || !item) return { error: `No se pudo crear el ítem logístico: ${itemError?.message ?? ''}` };

    await markConverted(supabase, code, input, input.status, 'LOGISTICS_ITEM', item.id, user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/radar`);
  revalidatePath(`/iniciativas/${code}/radar/${inputId}`);
  revalidatePath(`/iniciativas/${code}/logistica`);
  return { error: null };
}
