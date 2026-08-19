import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';
import InviteUserForm from './invite-user-form';

export default async function NewUserPage() {
  const user = await requireUser();
  if (user.role !== 'PRESIDENT') redirect('/');

  const supabase = await createClient();
  const { data: areas } = await supabase.from('areas').select('id, name').order('name');

  return (
    <AppShell user={user} active="/usuarios">
      <Breadcrumb backHref="/usuarios" backLabel="Usuarios" />
      <InviteUserForm areas={areas ?? []} />
    </AppShell>
  );
}
