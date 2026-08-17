import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import InviteUserForm from './invite-user-form';

export default async function NewUserPage() {
  const user = await requireUser();
  if (user.role !== 'PRESIDENT') redirect('/');

  const supabase = await createClient();
  const { data: areas } = await supabase.from('areas').select('id, name').order('name');

  return <InviteUserForm areas={areas ?? []} />;
}
