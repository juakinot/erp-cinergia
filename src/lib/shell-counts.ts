import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPendingApprovals, pendingCount } from '@/lib/approvals/queries';
import { getUnreadNotificationCount } from '@/lib/notifications/queries';
import type { AppRole } from '@/lib/initiatives/types';

/**
 * `AppShell` corre en TODA página autenticada — antes de este caché (D33)
 * eso significaba recalcular el badge de Aprobaciones y el de
 * notificaciones sin leer, contra Supabase, en cada clic del usuario, sin
 * importar que nada relevante hubiera cambiado desde el clic anterior.
 *
 * `unstable_cache` no puede leer `cookies()` (el cliente normal depende de
 * eso), así que esto usa el cliente admin — seguro acá porque
 * `getPendingApprovals`/`getUnreadNotificationCount` ya filtran
 * explícitamente por `user_id`/`area_id` en el código; RLS es un respaldo,
 * no lo único que acota el resultado a la persona correcta.
 *
 * Contrapartida consciente: el badge puede quedar hasta 15s desactualizado
 * tras aprobar algo o leer una notificación — no está enganchado a
 * `revalidateTag` en cada Server Action que lo afecta (son demasiados
 * puntos de escritura para ese costo hoy). Preferible a pagar la consulta
 * completa en cada clic.
 */
async function fetchShellCounts(userId: string, role: AppRole, areaId: string | null) {
  const admin = createAdminClient();
  const [pending, unreadCount] = await Promise.all([
    getPendingApprovals(admin, { id: userId, role, areaId }),
    getUnreadNotificationCount(admin, userId),
  ]);
  return { approvalsCount: pendingCount(pending), unreadCount };
}

export function getShellCounts(userId: string, role: AppRole, areaId: string | null) {
  return unstable_cache(() => fetchShellCounts(userId, role, areaId), ['shell-counts', userId, role, areaId ?? 'none'], {
    revalidate: 15,
  })();
}
