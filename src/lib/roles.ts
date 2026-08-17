import type { AppRole } from '@/lib/initiatives/types';

export const ROLE_LABELS: Record<AppRole, string> = {
  PRESIDENT: 'Presidente / Vicepresidente',
  AREA_DIRECTOR: 'Director de Área',
  REPORTS_DIRECTOR: 'Director de Reportes',
  COORDINATOR: 'Coordinador',
  MEMBER: 'Miembro',
};

/** Roles que pertenecen a una sola área. PRESIDENT y REPORTS_DIRECTOR son cross-área. */
export const AREA_SCOPED_ROLES: AppRole[] = ['AREA_DIRECTOR', 'COORDINATOR', 'MEMBER'];

export const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = (
  Object.keys(ROLE_LABELS) as AppRole[]
).map((value) => ({ value, label: ROLE_LABELS[value] }));
