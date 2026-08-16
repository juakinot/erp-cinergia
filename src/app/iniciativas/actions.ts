'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { validateTransition } from '@/lib/initiatives/state-machine';
import type { InitiativeRow, InitiativeStatus } from '@/lib/initiatives/types';

export type ActionState = { error: string | null };

const KANBAN_COLUMNS: Array<{ name: string; status: string; position: number }> = [
  { name: 'Pendiente', status: 'PENDING', position: 0 },
  { name: 'En progreso', status: 'IN_PROGRESS', position: 1 },
  { name: 'En revisión', status: 'IN_REVIEW', position: 2 },
  { name: 'Bloqueada', status: 'BLOCKED', position: 3 },
  { name: 'Completada', status: 'COMPLETED', position: 4 },
];

const CODE_PREFIX: Record<string, string> = { EVENT: 'EV', CAMPAIGN: 'CM', PROJECT: 'PY' };

async function fetchInitiative(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<InitiativeRow> {
  const { data, error } = await supabase.from('initiatives').select('*').eq('id', id).single();
  if (error || !data) throw new Error('Iniciativa no encontrada o sin acceso.');
  return data as InitiativeRow;
}

export async function createInitiative(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'PRESIDENT' && user.role !== 'AREA_DIRECTOR') {
    return { error: 'Solo Director de Área o Presidencia pueden crear iniciativas.' };
  }

  const areaId = String(formData.get('areaId') ?? '');
  const type = String(formData.get('type') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const objective = String(formData.get('objective') ?? '').trim();
  const modality = String(formData.get('modality') ?? '');
  const plannedDate = String(formData.get('plannedDate') ?? '');
  const coordinatorUserId = String(formData.get('coordinatorUserId') ?? '');
  const projectedBudgetRaw = String(formData.get('projectedBudget') ?? '').trim();
  const venue = String(formData.get('venue') ?? '').trim();

  if (!areaId || !type || !title || !description || !objective || !modality || !coordinatorUserId) {
    return { error: 'Completa todos los campos obligatorios.' };
  }

  const prefix = CODE_PREFIX[type];
  if (!prefix) return { error: 'Tipo de iniciativa inválido.' };

  const supabase = await createClient();
  const year = new Date().getFullYear();

  // Reintento simple ante colisión de secuencia: en el volumen de CINERGIA
  // (decenas de iniciativas al año) la probabilidad de choque real es baja,
  // pero el unique constraint (type, year, sequence) igual lo protege.
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
        area_id: areaId,
        title,
        description,
        objective,
        modality,
        planned_date: plannedDate || null,
        projected_budget: projectedBudgetRaw ? Number(projectedBudgetRaw) : null,
        venue: venue || null,
        coordinator_user_id: coordinatorUserId,
        created_by_user_id: user.id,
      })
      .select('code')
      .single();

    if (!error && created) {
      revalidatePath('/iniciativas');
      redirect(`/iniciativas/${created.code}`);
    }

    lastError = error?.message ?? 'Error desconocido';
    if (error?.code !== '23505') break; // no es choque de unicidad, no reintentar
  }

  return { error: `No se pudo crear la iniciativa: ${lastError}` };
}

export async function requestEscalation(initiativeId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'AREA_DIRECTOR') {
    return { error: 'Solo el Director de Área puede solicitar escalar a Presidencia.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('initiatives')
    .update({ escalation_requested_at: new Date().toISOString(), escalation_requested_by_user_id: user.id })
    .eq('id', initiativeId)
    .eq('status', 'PROPOSAL');

  if (error) return { error: error.message };
  revalidatePath(`/iniciativas`);
  return { error: null };
}

/**
 * PROPOSAL → APPROVED, encadenando de inmediato APPROVED → PLANNING (crea
 * el Kanban vacío) porque esa segunda transición es automática por diseño
 * (Arquitectura v2.1 §04). No es una transacción SQL real — supabase-js no
 * expone multi-statement transactions sin una función Postgres dedicada —
 * así que en el caso extremo de que el segundo paso falle, la iniciativa
 * queda visible en APPROVED sin Kanban. Aceptable para este alcance; si se
 * vuelve un problema real, se mueve a una función RPC atómica.
 */
export async function approveInitiative(initiativeId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiative(supabase, initiativeId);

  const result = await validateTransition(supabase, initiative, 'APPROVED', {
    id: user.id,
    role: user.role,
    areaId: user.areaId,
  });
  if (!result.ok) return { error: result.reason ?? 'Transición no permitida.' };

  const now = new Date().toISOString();
  const { error: approveError } = await supabase
    .from('initiatives')
    .update({
      status: 'APPROVED',
      approved_by_user_id: user.id,
      approved_at: now,
      escalation_reason: result.escalationReason ?? null,
    })
    .eq('id', initiativeId);
  if (approveError) return { error: approveError.message };

  await supabase.from('initiative_transitions').insert({
    initiative_id: initiativeId,
    from_status: 'PROPOSAL',
    to_status: 'APPROVED',
    actor_user_id: user.id,
    validation_snapshot: result,
  });

  // Encadenar el paso automático a PLANNING + Kanban vacío.
  const { error: planningError } = await supabase
    .from('initiatives')
    .update({ status: 'PLANNING' })
    .eq('id', initiativeId);
  if (planningError) return { error: `Aprobado, pero falló el paso automático a planificación: ${planningError.message}` };

  await supabase.from('initiative_transitions').insert({
    initiative_id: initiativeId,
    from_status: 'APPROVED',
    to_status: 'PLANNING',
    actor_user_id: user.id,
    reason: 'Automático al aprobar (Arquitectura v2.1 §04)',
  });

  const { data: board } = await supabase
    .from('kanban_boards')
    .insert({ initiative_id: initiativeId })
    .select('id')
    .single();
  if (board) {
    await supabase
      .from('kanban_columns')
      .insert(KANBAN_COLUMNS.map((c) => ({ board_id: board.id, ...c })));
  }

  revalidatePath(`/iniciativas`);
  revalidatePath(`/iniciativas/${initiative.code}`);
  return { error: null };
}

export async function cancelInitiative(initiativeId: string, reason: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (reason.trim().length < 20) {
    return { error: 'La razón de cancelación debe tener al menos 20 caracteres.' };
  }

  const supabase = await createClient();
  const initiative = await fetchInitiative(supabase, initiativeId);

  const result = await validateTransition(supabase, initiative, 'CANCELLED', {
    id: user.id,
    role: user.role,
    areaId: user.areaId,
  });
  if (!result.ok) return { error: result.reason ?? 'No se puede cancelar.' };

  const { error } = await supabase
    .from('initiatives')
    .update({ status: 'CANCELLED', cancelled_reason: reason.trim() })
    .eq('id', initiativeId);
  if (error) return { error: error.message };

  await supabase.from('initiative_transitions').insert({
    initiative_id: initiativeId,
    from_status: initiative.status,
    to_status: 'CANCELLED',
    actor_user_id: user.id,
    reason: reason.trim(),
  });

  revalidatePath('/iniciativas');
  revalidatePath(`/iniciativas/${initiative.code}`);
  return { error: null };
}

/**
 * Transiciones "simples": las que no requieren efectos secundarios como el
 * de aprobar (Kanban). Cubre PLANNING→READY, READY→EXECUTION,
 * EXECUTION→POST_EVENT, POST_EVENT→CLOSED.
 */
export async function advanceInitiative(initiativeId: string, toStatus: InitiativeStatus): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiative(supabase, initiativeId);

  const result = await validateTransition(supabase, initiative, toStatus, {
    id: user.id,
    role: user.role,
    areaId: user.areaId,
  });
  if (!result.ok) return { error: result.reason ?? 'Transición no permitida.' };

  const patch: Record<string, unknown> = { status: toStatus };
  if (toStatus === 'CLOSED') patch.closed_at = new Date().toISOString();

  const { error } = await supabase.from('initiatives').update(patch).eq('id', initiativeId);
  if (error) return { error: error.message };

  await supabase.from('initiative_transitions').insert({
    initiative_id: initiativeId,
    from_status: initiative.status,
    to_status: toStatus,
    actor_user_id: user.id,
    validation_snapshot: result,
  });

  revalidatePath('/iniciativas');
  revalidatePath(`/iniciativas/${initiative.code}`);
  return { error: null };
}
