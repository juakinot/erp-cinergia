'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { CalendarItemKind, CalendarVisibility } from '@/lib/calendar/types';
import { toLimaInstant } from '@/lib/time';

export type ActionState = { error: string | null };

export async function createCalendarItem(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const startsAtRaw = String(formData.get('startsAt') ?? '');
  const endsAtRaw = String(formData.get('endsAt') ?? '');
  const allDay = formData.get('allDay') === 'on';
  const location = String(formData.get('location') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'MEETING') as CalendarItemKind;
  // Alcance general (initiative_id null): PRIVATE queda invisible incluso
  // para quien lo crea (calendar_items_select solo admite TEAM/PUBLIC
  // cuando initiative_id es null) — por eso no se ofrece esa opción acá.
  const visibility = String(formData.get('visibility') ?? 'TEAM') as CalendarVisibility;

  if (!title || !startsAtRaw || !endsAtRaw) return { error: 'Completa título, inicio y fin.' };

  const startsAt = toLimaInstant(startsAtRaw);
  const endsAt = toLimaInstant(endsAtRaw);
  if (new Date(endsAt) < new Date(startsAt)) return { error: 'El fin no puede ser antes del inicio.' };

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { error } = await supabase.from('calendar_items').insert({
    title,
    description: description || null,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: allDay,
    location: location || null,
    kind,
    visibility,
    created_by_user_id: user.id,
  });
  if (error) return { error: `No se pudo agregar el evento: ${error.message}` };

  revalidatePath('/calendario');
  return { error: null };
}

export async function deleteCalendarItem(itemId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { error } = await supabase.from('calendar_items').delete().eq('id', itemId);
  if (error) return { error: error.message };

  revalidatePath('/calendario');
  return { error: null };
}
