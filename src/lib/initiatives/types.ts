/**
 * Tipos manuales para las consultas de Iniciativas hechas vía supabase-js.
 *
 * No se generan desde Prisma a propósito: estas consultas pasan por
 * PostgREST con la sesión del usuario (RLS activo), no por el cliente de
 * Prisma con service_role — son caminos de datos distintos. Los nombres de
 * columna son snake_case, los reales de la base de datos.
 */

export type InitiativeType = 'EVENT' | 'CAMPAIGN' | 'PROJECT';

export type InitiativeStatus =
  | 'IDEA'
  | 'PROPOSAL'
  | 'APPROVED'
  | 'PLANNING'
  | 'READY'
  | 'EXECUTION'
  | 'POST_EVENT'
  | 'CLOSED'
  | 'CANCELLED';

export type EscalationReason = 'BUDGET_THRESHOLD' | 'CROSS_AREA' | 'DIRECTOR_REQUEST';

export type AppRole = 'PRESIDENT' | 'AREA_DIRECTOR' | 'REPORTS_DIRECTOR' | 'COORDINATOR' | 'MEMBER' | 'DEAN';

export interface InitiativeRow {
  id: string;
  code: string;
  type: InitiativeType;
  area_id: string;
  status: InitiativeStatus;
  title: string;
  description: string;
  objective: string;
  modality: string;
  planned_date: string | null;
  planned_end_date: string | null;
  projected_budget: string | null;
  venue: string | null;
  coordinator_user_id: string;
  created_by_user_id: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  escalation_reason: EscalationReason | null;
  escalation_requested_at: string | null;
  escalation_requested_by_user_id: string | null;
  risk_level: 'GREEN' | 'AMBER' | 'RED';
  cancelled_reason: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface CurrentActor {
  id: string;
  role: AppRole;
  areaId: string | null;
}

export const STATUS_LABELS: Record<InitiativeStatus, string> = {
  IDEA: 'Idea',
  PROPOSAL: 'Propuesta',
  APPROVED: 'Aprobado',
  PLANNING: 'En planificación',
  READY: 'Listo para ejecución',
  EXECUTION: 'En ejecución',
  POST_EVENT: 'Post-evento',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado',
};

export const TYPE_LABELS: Record<InitiativeType, string> = {
  EVENT: 'Evento',
  CAMPAIGN: 'Campaña',
  PROJECT: 'Proyecto',
};
