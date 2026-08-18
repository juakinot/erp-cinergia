/**
 * Tipos manuales para Logística, mismo criterio que
 * src/lib/tasks/types.ts — consultas vía supabase-js con la sesión del
 * usuario (RLS activo), no vía Prisma Client.
 */

export type LogisticsItemStatus = 'PENDING' | 'DONE' | 'NOT_APPLICABLE';

export interface LogisticsItemRow {
  id: string;
  checklist_id: string;
  category: string;
  description: string;
  position: number;
  required: boolean;
  needs_evidence: boolean;
  status: LogisticsItemStatus;
  done_by_user_id: string | null;
  done_at: string | null;
  not_applicable_reason: string | null;
}

export const ITEM_STATUS_LABELS: Record<LogisticsItemStatus, string> = {
  PENDING: 'Pendiente',
  DONE: 'Hecho',
  NOT_APPLICABLE: 'No aplica',
};

/**
 * Categorías estándar sugeridas (comentario del esquema Prisma). Es un
 * punto de partida, no una lista cerrada — el campo es texto libre, así
 * que el formulario ofrece "Otra" para escribir una distinta.
 */
export const SUGGESTED_CATEGORIES = [
  'Permisos',
  'Materiales',
  'Difusión',
  'Catering',
  'Seguridad',
  'Tecnología',
] as const;
