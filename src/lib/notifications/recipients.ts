import type { SupabaseClient } from '@supabase/supabase-js';

/** Puede haber más de un Director/Subdirector compartiendo el rol en un área. */
export async function getAreaDirectorIds(supabase: SupabaseClient, areaId: string): Promise<string[]> {
  const { data } = await supabase.from('users').select('id').eq('role', 'AREA_DIRECTOR').eq('area_id', areaId);
  return (data ?? []).map((u) => u.id);
}

export async function getPresidentIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('users').select('id').eq('role', 'PRESIDENT');
  return (data ?? []).map((u) => u.id);
}
