import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import type { TaskPriority, TaskStatus } from '@/lib/tasks/types';
import { PersonalTaskCard } from './personal-task-card';

const COLUMNS: Array<{ status: TaskStatus; name: string }> = [
  { status: 'PENDING', name: 'Pendiente' },
  { status: 'IN_PROGRESS', name: 'En progreso' },
  { status: 'IN_REVIEW', name: 'En revisión' },
  { status: 'BLOCKED', name: 'Bloqueada' },
  { status: 'COMPLETED', name: 'Completada' },
];

export interface PersonalTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  requires_approval: boolean;
  blocked_reason: string | null;
  initiative_code: string;
  initiative_title: string;
}

export default async function MyKanbanPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('tasks')
    .select(
      'id, title, status, priority, due_date, requires_approval, blocked_reason, initiatives(code, title)'
    )
    .eq('assignee_user_id', user.id)
    .not('status', 'in', '(CANCELLED)');

  const rawTasks = (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    requires_approval: boolean;
    blocked_reason: string | null;
    initiatives: { code: string; title: string } | { code: string; title: string }[] | null;
  }>;

  const tasks: PersonalTask[] = rawTasks.map((t) => {
    const init = Array.isArray(t.initiatives) ? t.initiatives[0] : t.initiatives;
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      requires_approval: t.requires_approval,
      blocked_reason: t.blocked_reason,
      initiative_code: init?.code ?? '—',
      initiative_title: init?.title ?? '—',
    };
  });

  const tasksByStatus = new Map<TaskStatus, PersonalTask[]>();
  for (const t of tasks) {
    const list = tasksByStatus.get(t.status) ?? [];
    list.push(t);
    tasksByStatus.set(t.status, list);
  }

  return (
    <AppShell user={user} active="/mi-kanban">
      <div className="panel-head" style={{ border: 'none', marginBottom: 20, paddingBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Mi Kanban</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            Tus tareas asignadas, cruzando todas las iniciativas.
          </p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty">No tienes tareas asignadas todavía.</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => {
            const columnTasks = tasksByStatus.get(column.status) ?? [];
            return (
              <div key={column.status} className="w-72 shrink-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-panel)]">
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-3 py-2.5">
                  <h2 className="text-sm font-semibold text-[var(--text-1)]">{column.name}</h2>
                  <span className="rounded-full bg-[var(--surface-page)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-2)]">
                    {columnTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-2.5">
                  {columnTasks.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-[var(--text-3)]">Sin tareas.</p>
                  ) : (
                    columnTasks.map((task) => <PersonalTaskCard key={task.id} task={task} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
