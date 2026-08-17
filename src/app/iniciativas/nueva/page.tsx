import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import NewInitiativeForm from './new-initiative-form';

export default async function NewInitiativePage() {
  const user = await requireUser();
  if (user.role !== 'PRESIDENT' && user.role !== 'AREA_DIRECTOR') {
    redirect('/iniciativas');
  }

  const supabase = await createClient();

  const { data: areas } = await supabase
    .from('areas')
    .select('id, slug, name, default_initiative_type')
    .order('name');

  const { data: candidates } = await supabase
    .from('users')
    .select('id, full_name, role, area_id')
    .in('role', ['COORDINATOR', 'AREA_DIRECTOR'])
    .eq('status', 'ACTIVE');

  return (
    <NewInitiativeForm
      user={user}
      areas={areas ?? []}
      candidates={candidates ?? []}
      lockedAreaId={user.role === 'AREA_DIRECTOR' ? user.areaId : null}
    />
  );
}
