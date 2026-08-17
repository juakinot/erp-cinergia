import type { AppRole } from '@/lib/initiatives/types';

export type ActaStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';

/**
 * DRAFT lo elabora quien gestiona la iniciativa (Coordinador incluido).
 * REVIEW → APPROVED/DRAFT queda reservado a Director de Área o Presidencia
 * — el mismo Coordinador que redactó no se autoaprueba. Esto es una regla
 * de negocio, no algo que RLS distinga: `actas_update` permite escribir a
 * cualquiera que gestione la iniciativa (Coordinador incluido) porque RLS
 * protege el perímetro de datos, no la lógica de la transición (D7).
 */
export const ACTA_TRANSITIONS: Record<ActaStatus, ActaStatus[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['DRAFT', 'APPROVED'],
  APPROVED: ['PUBLISHED'],
  PUBLISHED: [],
};

export interface ActaValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateActaTransition(params: {
  fromStatus: ActaStatus;
  toStatus: ActaStatus;
  actorRole: AppRole;
  isManager: boolean;
  missingRequiredCount: number;
  requiresPresidencySignature: boolean;
  presidencyApprovedAt: string | null;
}): ActaValidationResult {
  const {
    fromStatus,
    toStatus,
    actorRole,
    isManager,
    missingRequiredCount,
    requiresPresidencySignature,
    presidencyApprovedAt,
  } = params;

  const allowed = ACTA_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    return { ok: false, reason: `No se puede pasar de "${fromStatus}" a "${toStatus}" directamente.` };
  }

  if (toStatus === 'REVIEW') {
    if (!isManager) return { ok: false, reason: 'No tienes autoridad para enviar esta acta a revisión.' };
    if (missingRequiredCount > 0) {
      return { ok: false, reason: `Faltan ${missingRequiredCount} campo(s) obligatorio(s) por llenar.` };
    }
    return { ok: true };
  }

  if (toStatus === 'DRAFT' || toStatus === 'APPROVED') {
    if (actorRole !== 'PRESIDENT' && actorRole !== 'AREA_DIRECTOR') {
      return { ok: false, reason: 'Solo Director de Área o Presidencia pueden revisar y aprobar el acta.' };
    }
    return { ok: true };
  }

  if (toStatus === 'PUBLISHED') {
    if (!isManager) return { ok: false, reason: 'No tienes autoridad para publicar esta acta.' };
    if (requiresPresidencySignature && !presidencyApprovedAt) {
      return { ok: false, reason: 'Falta la firma de Presidencia antes de publicar.' };
    }
    return { ok: true };
  }

  return { ok: false, reason: 'Transición no implementada.' };
}
