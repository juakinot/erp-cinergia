/**
 * Tipos manuales para Calendario general, mismo criterio que el resto de
 * módulos de esta app. Alcance de esta primera versión: ítems generales
 * (initiative_id null) — el calendario por iniciativa (visible dentro de
 * cada iniciativa) queda para una siguiente pasada.
 */

export type CalendarItemKind = 'MILESTONE' | 'MEETING' | 'DELIVERY' | 'EXECUTION';
export type CalendarVisibility = 'PRIVATE' | 'TEAM' | 'PUBLIC';

export interface CalendarItemRow {
  id: string;
  initiative_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  kind: CalendarItemKind;
  visibility: CalendarVisibility;
  created_by_user_id: string;
  created_by?: { full_name: string } | { full_name: string }[] | null;
}

export const KIND_LABELS: Record<CalendarItemKind, string> = {
  MILESTONE: 'Hito',
  MEETING: 'Reunión',
  DELIVERY: 'Entrega',
  EXECUTION: 'Ejecución',
};

export const KIND_BADGE: Record<CalendarItemKind, string> = {
  MILESTONE: 'b-info',
  MEETING: 'b-neutral',
  DELIVERY: 'b-amarillo',
  EXECUTION: 'b-rojo',
};

export const VISIBILITY_LABELS: Record<CalendarVisibility, string> = {
  PRIVATE: 'Privado',
  TEAM: 'Todo el equipo',
  PUBLIC: 'Público',
};
