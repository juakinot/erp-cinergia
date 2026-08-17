import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canManageInitiative } from '@/lib/initiatives/permissions';
import type { TaskPriority, TaskStatus } from '@/lib/tasks/types';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';
import { KanbanBoard } from './kanban-board';
import { NewTaskForm } from './new-task-form';

export interface TaskWithExtras {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  requires_approval: boolean;
  blocked_reason: string | null;
  assignee_user_id: string | null;
  assignee: { full_name: string } | null;
  kanban_card: { column_id: string; position: number } | null;
}

export default async function TasksPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('id, code, title, area_id, coordinator_user_id, areas(name)')
    .eq('code', code)
    .maybeSingle();

  if (!initiative) notFound();

  const row = initiative as unknown as {
    id: string;
    code: string;
    title: string;
    area_id: string;
    coordinator_user_id: string;
    areas: { name: string } | null;
  };

  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  const isManager = canManageInitiative(actor, row);

  const { data: board } = await supabase.from('kanban_boards').select('id').eq('initiative_id', row.id).maybeSingle();

  const { data: columns } = board
    ? await supabase
        .from('kanban_columns')
        .select('id, name, status, position')
        .eq('board_id', board.id)
        .order('position')
    : { data: null };

  const { data: rawTasks } = board
    ? await supabase
        .from('tasks')
        .select(
          'id, title, description, status, priority, due_date, requires_approval, blocked_reason, assignee_user_id, assignee:assignee_user_id(full_name), kanban_card:kanban_cards(column_id, position)'
        )
        .eq('initiative_id', row.id)
    : { data: null };

  // PostgREST devuelve las relaciones inversas (kanban_cards.task_id → tasks)
  // como arreglo aunque en la práctica sea 1 a 1 (task_id es @unique) — se
  // normaliza aquí, no en los componentes de cliente.
  const tasks = (rawTasks ?? []).map((t) => ({
    ...t,
    kanban_card: Array.isArray(t.kanban_card) ? (t.kanban_card[0] ?? null) : t.kanban_card,
  }));

  const { data: areaMembers } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('area_id', row.area_id)
    .eq('status', 'ACTIVE')
    .order('full_name');

  return (
    <AppShell user={user} active="/iniciativas">
      <Breadcrumb backHref={`/iniciativas/${row.code}`} backLabel={row.code} code="Tareas" />

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{row.title}</h1>
        {isManager && board && <NewTaskForm initiativeCode={row.code} areaMembers={areaMembers ?? []} />}
      </div>

      {!board ? (
        <div className="empty">
          El tablero de tareas se crea automáticamente al aprobar la iniciativa — todavía no existe para esta.
        </div>
      ) : (
        <KanbanBoard
          initiativeCode={row.code}
          columns={columns ?? []}
          tasks={tasks as unknown as TaskWithExtras[]}
          areaMembers={areaMembers ?? []}
          isManager={isManager}
          currentUserId={user.id}
        />
      )}
    </AppShell>
  );
}
