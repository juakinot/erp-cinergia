/**
 * Tipos manuales para Encuestas, mismo criterio que
 * src/lib/logistics/types.ts — consultas vía supabase-js con la sesión
 * del usuario (RLS activo), no vía Prisma Client.
 */

export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export type QuestionType = 'SCALE_1_5' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'OPEN_TEXT' | 'NUMERIC';

export interface SurveyRow {
  id: string;
  initiative_id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  anonymous: boolean;
  opens_at: string | null;
  closes_at: string | null;
}

export interface SurveyQuestionRow {
  id: string;
  survey_id: string;
  text: string;
  type: QuestionType;
  position: number;
  required: boolean;
  options: string[] | null;
}

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  CLOSED: 'Cerrada',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SCALE_1_5: 'Escala 1 a 5',
  SINGLE_CHOICE: 'Opción única',
  MULTIPLE_CHOICE: 'Opción múltiple',
  OPEN_TEXT: 'Texto abierto',
  NUMERIC: 'Número',
};

/** Tipos que necesitan una lista de opciones para armar la pregunta. */
export const CHOICE_TYPES: QuestionType[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'];
