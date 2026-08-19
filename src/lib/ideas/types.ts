/**
 * Tipos manuales para Ideación, mismo criterio que el resto de módulos
 * de esta app.
 */

export type CampaignStatus = 'SCHEDULED' | 'ACTIVE' | 'CLOSED';
export type IdeaStatus = 'DRAFT' | 'ACTIVE' | 'PROMOTED' | 'DISCARDED';

export interface IdeaCampaignRow {
  id: string;
  title: string;
  description: string | null;
  status: CampaignStatus;
  opens_at: string;
  closes_at: string;
  vote_threshold: number;
}

export interface IdeaRow {
  id: string;
  campaign_id: string;
  area_id: string;
  author_user_id: string;
  title: string;
  description: string;
  objective: string;
  modality: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
  status: IdeaStatus;
  discarded_reason: string | null;
  created_at: string;
  author?: { full_name: string } | { full_name: string }[] | null;
  areas?: { name: string } | { name: string }[] | null;
  vote_count?: number;
  voted_by_me?: boolean;
}

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  PROMOTED: 'Promovida',
  DISCARDED: 'Descartada',
};

export const IDEA_STATUS_BADGE: Record<IdeaStatus, string> = {
  DRAFT: 'b-neutral',
  ACTIVE: 'b-info',
  PROMOTED: 'b-verde',
  DISCARDED: 'b-rojo',
};
