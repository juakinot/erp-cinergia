/**
 * Tipos manuales para Observaciones, mismo criterio que el resto de
 * módulos de esta app (consultas vía supabase-js con la sesión del
 * usuario, RLS activo).
 */

export type ObservationVisibility = 'INTERNAL' | 'DIRECTION';

export interface ObservationRow {
  id: string;
  initiative_id: string;
  author_user_id: string;
  body: string;
  visibility: ObservationVisibility;
  resolved: boolean;
  resolved_at: string | null;
  parent_id: string | null;
  source_input_id: string | null;
  created_at: string;
  author?: { full_name: string } | { full_name: string }[] | null;
}

export const VISIBILITY_LABELS: Record<ObservationVisibility, string> = {
  INTERNAL: 'Todo el equipo',
  DIRECTION: 'Solo Dirección',
};
