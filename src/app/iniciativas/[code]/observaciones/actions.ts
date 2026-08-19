'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { notify, notifyMany } from '@/lib/notifications/notify';
import { getAreaDirectorIds } from '@/lib/notifications/recipients';
import type { ObservationVisibility } from '@/lib/observations/types';

export type ActionState = { error: string | null };

async function fetchInitiativeForObservations(supabase: Awaited<ReturnType<typeof createClient>>, code: string) {
  const { data, error } = await supabase
    .from('initiatives')
    .select('id, code, title, area_id')
    .eq('code', code)
    .maybeSingle();
  if (error || !data) throw new Error('Iniciativa no encontrada o sin acceso.');
  return data;
}

export async function createObservation(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  const visibility = String(formData.get('visibility') ?? 'INTERNAL') as ObservationVisibility;

  if (!body) return { error: 'Escribe el contenido de la observación.' };

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role === 'MEMBER') {
    return { error: 'Un Miembro solo puede responder observaciones existentes, no abrir una nueva.' };
  }

  const supabase = await createClient();

  try {
    const initiative = await fetchInitiativeForObservations(supabase, code);
    // Sin `.select()` tras el insert a propósito: si visibility es
    // DIRECTION y quien publica no es PRESIDENT/AREA_DIRECTOR, la fila
    // recién creada no es visible bajo su propia sesión según
    // observations_select — pedir RETURNING chocaría con esa política
    // (mismo problema que D21 con encuestas anónimas). El id se genera
    // acá para poder usarlo igual en la notificación.
    const observationId = randomUUID();
    const { error } = await supabase.from('observations').insert({
      id: observationId,
      initiative_id: initiative.id,
      author_user_id: user.id,
      body,
      visibility,
    });
    if (error) return { error: `No se pudo publicar la observación: ${error.message}` };

    if (visibility === 'DIRECTION') {
      const directorIds = (await getAreaDirectorIds(supabase, initiative.area_id)).filter((id) => id !== user.id);
      await notifyMany(directorIds, {
        category: 'INITIATIVES',
        kind: 'observation.direction',
        subjectType: 'observation',
        subjectId: observationId,
        title: `Observación solo para Dirección: ${initiative.title}`,
        linkPath: `/iniciativas/${code}/observaciones`,
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/observaciones`);
  return { error: null };
}

export async function replyObservation(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const parentId = String(formData.get('parentId') ?? '');
  const body = String(formData.get('body') ?? '').trim();

  if (!body) return { error: 'Escribe una respuesta.' };

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  try {
    const initiative = await fetchInitiativeForObservations(supabase, code);

    const { data: parent } = await supabase
      .from('observations')
      .select('author_user_id, visibility')
      .eq('id', parentId)
      .maybeSingle();
    if (!parent) return { error: 'La observación original no existe o no tienes acceso.' };

    const { error } = await supabase.from('observations').insert({
      initiative_id: initiative.id,
      author_user_id: user.id,
      body,
      visibility: parent.visibility,
      parent_id: parentId,
    });
    if (error) return { error: `No se pudo publicar la respuesta: ${error.message}` };

    if (parent.author_user_id !== user.id) {
      await notify({
        userId: parent.author_user_id,
        category: 'INITIATIVES',
        kind: 'observation.replied',
        subjectType: 'observation',
        subjectId: parentId,
        title: `Nueva respuesta a tu observación en ${initiative.title}`,
        linkPath: `/iniciativas/${code}/observaciones`,
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/observaciones`);
  return { error: null };
}

export async function toggleResolved(code: string, observationId: string, resolved: boolean): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { error } = await supabase
    .from('observations')
    .update({ resolved, resolved_at: resolved ? new Date().toISOString() : null })
    .eq('id', observationId);
  if (error) return { error: error.message };

  revalidatePath(`/iniciativas/${code}/observaciones`);
  return { error: null };
}
