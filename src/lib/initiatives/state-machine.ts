import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentActor, EscalationReason, InitiativeRow, InitiativeStatus } from './types';

/**
 * Grafo de transiciones válidas. `CANCELLED` es alcanzable desde cualquier
 * estado no terminal — se agrega mecánicamente al validar, no está repetido
 * aquí en cada fila (ver `validateTransition`).
 */
export const TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
  IDEA: ['PROPOSAL'],
  PROPOSAL: ['APPROVED'],
  APPROVED: ['PLANNING'],
  PLANNING: ['READY'],
  READY: ['EXECUTION'],
  EXECUTION: ['POST_EVENT'],
  POST_EVENT: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  /** Solo relevante para PROPOSAL → APPROVED. */
  escalationReason?: EscalationReason | null;
}

export async function getEscalationThreshold(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'escalation.budget_threshold_pen')
    .maybeSingle();
  const value = data?.value;
  return typeof value === 'number' ? value : 2000;
}

/**
 * PROPOSAL → APPROVED — la regla de escalación real (Arquitectura v2.1 §01,
 * Decisiones vigentes de la especificación v1.3): el Director de Área
 * aprueba dentro de su autoridad por defecto; Presidencia solo interviene
 * si el presupuesto supera el umbral o el propio Director pidió escalar.
 *
 * "Cross-área" (la tercera causa de escalación del documento) no tiene campo
 * en el esquema todavía — una iniciativa pertenece a una sola área — así que
 * no se evalúa aquí. Queda como limitación conocida, no como bug silencioso.
 */
async function validateApprove(
  supabase: SupabaseClient,
  initiative: InitiativeRow,
  actor: CurrentActor
): Promise<ValidationResult> {
  if (!initiative.planned_date) {
    return { ok: false, reason: 'Falta la fecha planificada antes de poder aprobar.' };
  }

  const threshold = await getEscalationThreshold(supabase);
  const budget = initiative.projected_budget ? Number(initiative.projected_budget) : 0;
  const overThreshold = budget > threshold;
  const escalationRequested = Boolean(initiative.escalation_requested_at);

  if (actor.role === 'PRESIDENT') {
    const reason: EscalationReason | null = overThreshold
      ? 'BUDGET_THRESHOLD'
      : escalationRequested
        ? 'DIRECTOR_REQUEST'
        : null;
    return { ok: true, escalationReason: reason };
  }

  if (actor.role === 'AREA_DIRECTOR') {
    if (overThreshold) {
      return {
        ok: false,
        reason: `El presupuesto proyectado (S/ ${budget.toFixed(2)}) supera el umbral de S/ ${threshold.toFixed(2)}. Solo Presidencia puede aprobar esta iniciativa.`,
      };
    }
    if (escalationRequested) {
      return {
        ok: false,
        reason: 'Ya se solicitó escalar esta iniciativa a Presidencia — espera su decisión.',
      };
    }
    return { ok: true, escalationReason: null };
  }

  return { ok: false, reason: 'Tu rol no tiene autoridad para aprobar iniciativas.' };
}

/**
 * PLANNING → READY — requisitos de cierre por tipo (Arquitectura v2.1 §02).
 * Con Actas/Logística/Tareas recién empezando a construirse, esto bloqueará
 * honestamente casi siempre por ahora — eso es correcto, no un placeholder:
 * refleja que todavía no existe la evidencia que la transición exige.
 */
async function validateReady(supabase: SupabaseClient, initiative: InitiativeRow): Promise<ValidationResult> {
  const { data: acta } = await supabase
    .from('actas')
    .select('status, presidency_approved_at')
    .eq('initiative_id', initiative.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!acta || (acta.status !== 'APPROVED' && acta.status !== 'PUBLISHED')) {
    return { ok: false, reason: 'No hay un acta aprobada para esta iniciativa.' };
  }
  if (initiative.type === 'PROJECT' && !acta.presidency_approved_at) {
    return {
      ok: false,
      reason: 'El acta de proyecto también requiere la firma de Presidencia (ver plantilla oficial).',
    };
  }

  if (initiative.type === 'EVENT') {
    const { data: checklist } = await supabase
      .from('logistics_checklists')
      .select('id')
      .eq('initiative_id', initiative.id)
      .maybeSingle();

    if (!checklist) {
      return { ok: false, reason: 'No existe checklist logístico para este evento.' };
    }

    const { data: items } = await supabase
      .from('logistics_items')
      .select('status')
      .eq('checklist_id', checklist.id)
      .eq('required', true);

    // "No aplica" también resuelve el ítem — existe justo para los casos
    // donde el checklist estándar trae algo que este evento en particular
    // no necesita (ver notApplicableReason en el esquema). Solo PENDING
    // cuenta como sin resolver.
    const pending = (items ?? []).filter((i) => i.status === 'PENDING').length;
    if (pending > 0) {
      return { ok: false, reason: `Faltan ${pending} ítem(s) obligatorios del checklist logístico.` };
    }
  }

  const { data: blockedTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('initiative_id', initiative.id)
    .eq('status', 'BLOCKED')
    .in('priority', ['HIGH', 'CRITICAL']);

  if ((blockedTasks ?? []).length > 0) {
    return { ok: false, reason: 'Hay tareas bloqueadas de prioridad alta o crítica sin resolver.' };
  }

  return { ok: true };
}

/**
 * POST_EVENT → CLOSED — mismo espíritu que validateReady: honesto sobre lo
 * que falta, no decorativo.
 */
async function validateClosed(supabase: SupabaseClient, initiative: InitiativeRow): Promise<ValidationResult> {
  const { data: openTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('initiative_id', initiative.id)
    .not('status', 'in', '(COMPLETED,CANCELLED)');

  if ((openTasks ?? []).length > 0) {
    return { ok: false, reason: `Hay ${openTasks!.length} tarea(s) sin cerrar.` };
  }

  if (initiative.type === 'EVENT') {
    const { data: survey } = await supabase
      .from('surveys')
      .select('status')
      .eq('initiative_id', initiative.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!survey || survey.status !== 'CLOSED') {
      return { ok: false, reason: 'La encuesta post-evento debe estar cerrada antes de archivar la iniciativa.' };
    }
  }

  if (initiative.risk_level === 'RED') {
    return {
      ok: false,
      reason: 'El semáforo está en rojo — resuelve los riesgos críticos antes de cerrar.',
    };
  }

  return { ok: true };
}

/**
 * Punto de entrada único del motor. Nunca se debe mutar `initiatives.status`
 * fuera de esta función — es donde vive toda la lógica de negocio de la
 * máquina de estados (D7 en decisiones-tecnicas.md: RLS protege el
 * perímetro de datos, esta capa protege la lógica de transición).
 */
export async function validateTransition(
  supabase: SupabaseClient,
  initiative: InitiativeRow,
  toStatus: InitiativeStatus,
  actor: CurrentActor
): Promise<ValidationResult> {
  if (toStatus === 'CANCELLED') {
    if (initiative.status === 'CLOSED' || initiative.status === 'CANCELLED') {
      return { ok: false, reason: `No se puede cancelar una iniciativa en estado ${initiative.status}.` };
    }
    if (actor.role !== 'PRESIDENT' && actor.role !== 'AREA_DIRECTOR') {
      return { ok: false, reason: 'Solo Director de Área o Presidencia pueden cancelar.' };
    }
    return { ok: true };
  }

  const allowed = TRANSITIONS[initiative.status] ?? [];
  if (!allowed.includes(toStatus)) {
    return {
      ok: false,
      reason: `No se puede pasar de "${initiative.status}" a "${toStatus}" directamente.`,
    };
  }

  switch (`${initiative.status}->${toStatus}`) {
    case 'PROPOSAL->APPROVED':
      return validateApprove(supabase, initiative, actor);
    case 'APPROVED->PLANNING':
      return { ok: true }; // automático por diseño (Arquitectura v2.1 §04)
    case 'PLANNING->READY':
      return validateReady(supabase, initiative);
    case 'READY->EXECUTION':
      return { ok: true }; // "manual por CO/DA" ya es la condición que se cumple al hacer clic
    case 'EXECUTION->POST_EVENT':
      return { ok: true };
    case 'POST_EVENT->CLOSED':
      return validateClosed(supabase, initiative);
    default:
      return { ok: false, reason: 'Transición no implementada.' };
  }
}
