import type { TaskStatus } from './types';

/**
 * Grafo de transiciones de una tarea. OVERDUE queda fuera a propósito —
 * nada la asigna todavía (ver nota en types.ts) — así que no aparece como
 * origen ni destino de ninguna transición manual.
 */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED', 'CANCELLED'],
  IN_REVIEW: ['IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  OVERDUE: [],
};

export interface TaskValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Reglas de negocio de una tarea — separado de RLS a propósito (mismo
 * principio que D7 en decisiones-tecnicas.md para iniciativas): RLS ya
 * garantiza que solo quien gestiona la iniciativa o la persona asignada
 * puede escribir la fila; esto decide qué movimiento es válido dado el
 * estado actual y quién lo pide.
 */
export function validateTaskTransition(params: {
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  requiresApproval: boolean;
  isManager: boolean;
  reason?: string;
}): TaskValidationResult {
  const { fromStatus, toStatus, requiresApproval, isManager, reason } = params;

  const allowed = TASK_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    return { ok: false, reason: `No se puede pasar de "${fromStatus}" a "${toStatus}" directamente.` };
  }

  if (toStatus === 'BLOCKED' && !reason?.trim()) {
    return { ok: false, reason: 'Bloquear una tarea requiere indicar el motivo.' };
  }

  // Prioridad alta/crítica exige que quien gestiona la iniciativa confirme
  // el cierre — no basta con que la persona asignada se autocomplete.
  if (toStatus === 'COMPLETED' && requiresApproval && !isManager) {
    return {
      ok: false,
      reason: 'Esta tarea es de prioridad alta o crítica — solo quien gestiona la iniciativa puede marcarla como completada.',
    };
  }

  return { ok: true };
}
