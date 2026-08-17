/**
 * Tipos manuales para las consultas de Tareas/Kanban hechas vía supabase-js
 * (sesión del usuario, RLS activo) — mismo criterio que
 * src/lib/initiatives/types.ts: no se generan desde Prisma porque esta app
 * no lee estas tablas a través del cliente de Prisma.
 */

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TaskRow {
  id: string;
  initiative_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_user_id: string | null;
  created_by_user_id: string;
  due_date: string | null;
  requires_approval: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/**
 * Las 5 columnas que crea `approveInitiative` cubren estos estados. OVERDUE
 * no tiene columna propia — no hay todavía un proceso que la calcule y
 * asigne (requeriría un job programado); una tarea vencida sigue
 * mostrándose en su columna real, con la fecha límite en rojo. CANCELLED
 * tampoco tiene columna: la tarjeta se queda en la última columna real,
 * marcada como cancelada.
 */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisión',
  BLOCKED: 'Bloqueada',
  COMPLETED: 'Completada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: 'bg-[#E8EEF5] text-[#5A6B82]',
  MEDIUM: 'bg-[#CCE5FF] text-[#0066CC]',
  HIGH: 'bg-[#FDE4C0] text-[#F29918]',
  CRITICAL: 'bg-[#F4D2D5] text-[#B4232F]',
};
