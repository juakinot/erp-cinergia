'use client';

import type { TaskWithExtras } from './page';
import { TaskCard } from './task-card';

interface Column {
  id: string;
  name: string;
  status: string;
  position: number;
}

export function KanbanBoard({
  initiativeCode,
  columns,
  tasks,
  areaMembers,
  isManager,
  currentUserId,
}: {
  initiativeCode: string;
  columns: Column[];
  tasks: TaskWithExtras[];
  areaMembers: Array<{ id: string; full_name: string }>;
  isManager: boolean;
  currentUserId: string;
}) {
  const tasksByColumn = new Map<string, TaskWithExtras[]>();
  for (const task of tasks) {
    const columnId = task.kanban_card?.column_id;
    if (!columnId) continue;
    const list = tasksByColumn.get(columnId) ?? [];
    list.push(task);
    tasksByColumn.set(columnId, list);
  }
  for (const list of tasksByColumn.values()) {
    list.sort((a, b) => (a.kanban_card?.position ?? 0) - (b.kanban_card?.position ?? 0));
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnTasks = tasksByColumn.get(column.id) ?? [];
        return (
          <div key={column.id} className="w-72 shrink-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-panel)]">
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
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    initiativeCode={initiativeCode}
                    areaMembers={areaMembers}
                    isManager={isManager}
                    currentUserId={currentUserId}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
