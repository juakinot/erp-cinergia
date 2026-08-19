import type { SupabaseClient } from '@supabase/supabase-js';

export interface NotificationRow {
  id: string;
  category: string;
  kind: string;
  subject_type: string;
  subject_id: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
}

export async function getUnreadNotificationCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  return count ?? 0;
}
