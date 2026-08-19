import { createAdminClient } from '@/lib/supabase/admin';

export type NotificationCategory = 'DUE_DATES' | 'APPROVALS' | 'RADAR' | 'INITIATIVES' | 'SYSTEM';

interface NotifyParams {
  userId: string;
  category: NotificationCategory;
  /** Identificador estable del trigger, ej. "initiative.needs_approval". */
  kind: string;
  subjectType: string;
  subjectId: string;
  title: string;
  body?: string;
  linkPath?: string;
}

/**
 * Crea una notificación in-app para OTRO usuario (no el actor de la sesión
 * actual) — por eso usa el cliente admin, ver el comentario en
 * src/lib/supabase/admin.ts. `upsert` + `ignoreDuplicates` aprovecha el
 * unique(user_id, kind, subject_id) del esquema para idempotencia: repetir
 * el mismo trigger sobre el mismo objeto no duplica la notificación.
 */
export async function notify(params: NotifyParams): Promise<void> {
  const admin = createAdminClient();
  await admin.from('notifications').upsert(
    {
      user_id: params.userId,
      category: params.category,
      kind: params.kind,
      subject_type: params.subjectType,
      subject_id: params.subjectId,
      title: params.title,
      body: params.body ?? null,
      link_path: params.linkPath ?? null,
    },
    { onConflict: 'user_id,kind,subject_id', ignoreDuplicates: true }
  );
}

/** Notifica al mismo destinatario y trigger para varios usuarios a la vez. */
export async function notifyMany(userIds: string[], params: Omit<NotifyParams, 'userId'>): Promise<void> {
  await Promise.all(userIds.map((userId) => notify({ ...params, userId })));
}
