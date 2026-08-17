'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canManageInitiative } from '@/lib/initiatives/permissions';
import { validateTaskTransition } from '@/lib/tasks/state-machine';
import type { TaskPriority, TaskStatus } from '@/lib/tasks/types';

export type ActionState = { error: string | null };

async function fetchInitiativeForTasks(supabase: Awaited<ReturnType<typeof createClient>>, code: string) {
  const { data, error } = await supabase
    .from('initiatives')
    .select('id, code, area_id, coordinator_user_id')
    .eq('code', code)
    .maybeSingle();
  if (error || !data) throw new Error('Iniciativa no encontrada o sin acceso.');
  return data;
}

export async function createTask(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const code = String(formData.get('initiativeCode') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const priority = String(formData.get('priority') ?? 'MEDIUM') as TaskPriority;
  const assigneeUserId = String(formData.get('assigneeUserId') ?? '').trim() || null;
  const dueDate = String(formData.get('dueDate') ?? '').trim() || null;

  if (!title) return { error: 'El título es obligatorio.' };

  const supabase = await createClient();
  const initiative = await fetchInitiativeForTasks(supabase, code);

  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  if (!canManageInitiative(actor, initiative)) {
    return { error: 'No tienes autoridad para crear tareas en esta iniciativa.' };
  }

  const requiresApproval = priority === 'HIGH' || priority === 'CRITICAL';

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      initiative_id: initiative.id,
      title,
      description: description || null,
      priority,
      assignee_user_id: assigneeUserId,
      created_by_user_id: user.id,
      due_date: dueDate,
      requires_approval: requiresApproval,
    })
    .select('id')
    .single();

  if (taskError || !task) {
    return { error: `No se pudo crear la tarea: ${taskError?.message ?? 'error desconocido'}` };
  }

  // La tarjeta nace en la columna "Pendiente" del tablero ya creado al
  // aprobar la iniciativa (ver approveInitiative en ../actions.ts).
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

  revalidatePath(`/iniciativas/${code}/tareas`);
  return { error: null };
}

export async function moveTask(
  code: string,
  taskId: string,
  toStatus: TaskStatus,
  reason?: string
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiativeForTasks(supabase, code);
  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  const isManager = canManageInitiative(actor, initiative);

  const { data: task } = await supabase
    .from('tasks')
    .select('id, status, requires_approval, assignee_user_id')
    .eq('id', taskId)
    .maybeSingle();
  if (!task) return { error: 'Tarea no encontrada o sin acceso.' };

  if (!isManager && task.assignee_user_id !== user.id) {
    return { error: 'Solo la persona asignada o quien gestiona la iniciativa puede mover esta tarea.' };
  }

  const result = validateTaskTransition({
    fromStatus: task.status,
    toStatus,
    requiresApproval: task.requires_approval,
    isManager,
    reason,
  });
  if (!result.ok) return { error: result.reason ?? 'Transición no permitida.' };

  const patch: Record<string, unknown> = { status: toStatus };
  patch.blocked_reason = toStatus === 'BLOCKED' ? reason!.trim() : null;
  patch.blocked_at = toStatus === 'BLOCKED' ? new Date().toISOString() : null;
  patch.completed_at = toStatus === 'COMPLETED' ? new Date().toISOString() : null;

  const { error: updateError } = await supabase.from('tasks').update(patch).eq('id', taskId);
  if (updateError) return { error: updateError.message };

  await supabase.from('task_transitions').insert({
    task_id: taskId,
    from_status: task.status,
    to_status: toStatus,
    actor_user_id: user.id,
    reason: reason?.trim() || null,
  });

  // Mover la tarjeta a la columna del nuevo estado. CANCELLED no tiene
  // columna propia (ver types.ts) — la tarjeta se queda donde estaba.
  if (toStatus !== 'CANCELLED') {
    const { data: card } = await supabase
      .from('kanban_cards')
      .select('id, column_id')
      .eq('task_id', taskId)
      .maybeSingle();

    if (card) {
      const { data: board } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('initiative_id', initiative.id)
        .maybeSingle();

      if (board) {
        const { data: targetColumn } = await supabase
          .from('kanban_columns')
          .select('id')
          .eq('board_id', board.id)
          .eq('status', toStatus)
          .maybeSingle();

        if (targetColumn && targetColumn.id !== card.column_id) {
          const { count } = await supabase
            .from('kanban_cards')
            .select('id', { count: 'exact', head: true })
            .eq('column_id', targetColumn.id);
          await supabase
            .from('kanban_cards')
            .update({ column_id: targetColumn.id, position: count ?? 0 })
            .eq('id', card.id);
        }
      }
    }
  }

  revalidatePath(`/iniciativas/${code}/tareas`);
  revalidatePath(`/iniciativas/${code}`);
  return { error: null };
}

export async function assignTask(code: string, taskId: string, assigneeUserId: string | null): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiativeForTasks(supabase, code);
  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  if (!canManageInitiative(actor, initiative)) {
    return { error: 'No tienes autoridad para reasignar tareas.' };
  }

  const { error } = await supabase.from('tasks').update({ assignee_user_id: assigneeUserId }).eq('id', taskId);
  if (error) return { error: error.message };

  revalidatePath(`/iniciativas/${code}/tareas`);
  return { error: null };
}
