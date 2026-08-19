/**
 * Tipos manuales para Propuestas de mejora, mismo criterio que el resto
 * de módulos de esta app (consultas vía supabase-js con la sesión del
 * usuario, RLS activo).
 */

export type ProposalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'CONVERTED';

export interface ImprovementProposalRow {
  id: string;
  author_user_id: string;
  title: string;
  rationale: string;
  suggested_action: string;
  status: ProposalStatus;
  affected_area_ids: string[];
  decided_by_user_id: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  created_at: string;
  author?: { full_name: string } | { full_name: string }[] | null;
  decided_by?: { full_name: string } | { full_name: string }[] | null;
}

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  PROPOSED: 'Propuesta',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CONVERTED: 'Convertida en acción',
};

export const PROPOSAL_STATUS_BADGE: Record<ProposalStatus, string> = {
  PROPOSED: 'b-neutral',
  APPROVED: 'b-verde',
  REJECTED: 'b-rojo',
  CONVERTED: 'b-verde',
};
