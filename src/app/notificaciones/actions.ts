'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error: string | null };

export async function markAsRead(notificationId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/notificaciones');
  return { error: null };
}

export async function markAllAsRead(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
  if (error) return { error: error.message };

  revalidatePath('/notificaciones');
  return { error: null };
}
