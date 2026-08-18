/**
 * Tipos manuales para el Radar operativo (`initiative_inputs`), mismo
 * criterio que src/lib/logistics/types.ts y src/lib/surveys/types.ts.
 */

export type InputKind =
  | 'TASK_SUGGESTION'
  | 'RISK_ALERT'
  | 'LOGISTICS_NEED'
  | 'OPERATIONAL_NOTE'
  | 'DATE_ADJUSTMENT'
  | 'OWNER_CHANGE'
  | 'FINDING'
  | 'IMPROVEMENT'
  | 'SUPPORT_REQUEST'
  | 'QUICK_IDEA';

export type InputStatus = 'PROPOSED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'CLOSED';

export type ConvertedToType = 'TASK' | 'RISK' | 'LOGISTICS_ITEM' | 'OBSERVATION';

export interface InitiativeInputRow {
  id: string;
  initiative_id: string;
  author_user_id: string;
  kind: InputKind;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: InputStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  duplicate_of_id: string | null;
  converted_to_type: ConvertedToType | null;
  converted_to_id: string | null;
  converted_by_user_id: string | null;
  converted_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  author?: { full_name: string } | { full_name: string }[] | null;
  reviewed_by?: { full_name: string } | { full_name: string }[] | null;
}

export interface InputTransitionRow {
  id: string;
  input_id: string;
  from_status: InputStatus | null;
  to_status: InputStatus;
  actor_user_id: string;
  notes: string | null;
  created_at: string;
  actor?: { full_name: string } | { full_name: string }[] | null;
}

export const INPUT_KIND_LABELS: Record<InputKind, string> = {
  TASK_SUGGESTION: 'Sugerencia de tarea',
  RISK_ALERT: 'Alerta de riesgo',
  LOGISTICS_NEED: 'Necesidad logística',
  OPERATIONAL_NOTE: 'Nota operativa',
  DATE_ADJUSTMENT: 'Ajuste de fecha',
  OWNER_CHANGE: 'Cambio de responsable',
  FINDING: 'Hallazgo',
  IMPROVEMENT: 'Mejora',
  SUPPORT_REQUEST: 'Solicitud de apoyo',
  QUICK_IDEA: 'Idea rápida',
};

export const INPUT_STATUS_LABELS: Record<InputStatus, string> = {
  PROPOSED: 'Propuesto',
  IN_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CONVERTED: 'Convertido',
  CLOSED: 'Cerrado',
};

export const INPUT_STATUS_BADGE: Record<InputStatus, string> = {
  PROPOSED: 'b-neutral',
  IN_REVIEW: 'b-info',
  APPROVED: 'b-verde',
  REJECTED: 'b-rojo',
  CONVERTED: 'b-verde',
  CLOSED: 'b-neutral',
};

export const CONVERTED_TO_LABELS: Record<ConvertedToType, string> = {
  TASK: 'Tarea',
  RISK: 'Riesgo',
  LOGISTICS_ITEM: 'Ítem logístico',
  OBSERVATION: 'Observación',
};
