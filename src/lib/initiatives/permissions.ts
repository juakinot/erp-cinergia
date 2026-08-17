import type { CurrentActor } from './types';

/**
 * Espeja exactamente `can_manage_initiative()` en RLS
 * (prisma/sql/01_rls_policies.sql) — misma autoridad, calculada del lado
 * del cliente para decidir qué mostrar en la UI. RLS ya la hace cumplir
 * de verdad; esto es solo para no mostrar botones que van a fallar.
 */
export function canManageInitiative(
  actor: CurrentActor,
  initiative: { area_id: string; coordinator_user_id: string }
): boolean {
  if (actor.role === 'PRESIDENT') return true;
  if (actor.role === 'AREA_DIRECTOR') return actor.areaId === initiative.area_id;
  if (actor.role === 'COORDINATOR') return actor.id === initiative.coordinator_user_id;
  return false;
}
