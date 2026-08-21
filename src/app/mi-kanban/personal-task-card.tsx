'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moveTask } from '../iniciativas/[code]/tareas/actions';
import { TASK_TRANSITIONS } from '@/lib/tasks/state-machine';
import { PRIORITY_LABELS, PRIORITY_STYLES, type TaskStatus } from '@/lib/tasks/types';
import type { PersonalTask } from './page';

const MOVE_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Volver a pendiente',
  IN_PROGRESS: 'Iniciar',
  IN_REVIEW: 'Enviar a revisión',
  BLOCKED: 'Bloquear',
  COMPLETED: 'Completar',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelar',
};

export function PersonalTaskCard({ task }: { task: PersonalTask }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockingReason, setBlockingReason] = useState<string | null>(null);

  const candidates = TASK_TRANSITIONS[task.status] ?? [];

  function move(toStatus: TaskStatus, reason?: string) {
    startTransition(async () => {
      const result = await moveTask(task.initiative_code, task.id, toStatus, reason);
      setError(result.error);
      if (!result.error) {
        setBlockingReason(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-md border border-[var(--border-soft)] p-2.5 text-sm">
      <p className="font-medium text-[var(--text-1)]">{task.title}</p>
      <Link href={`/iniciativas/${task.initiative_code}/tareas`} className="text-[10px] text-[var(--brand-primary)] hover:underline">
        {task.initiative_code} · {task.initiative_title}
      </Link>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLES[task.priority]}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        {task.due_date && (
          <span className="text-[10px] text-[var(--text-2)]">{new Date(task.due_date).toLocaleDateString('es-PE')}</span>
        )}
      </div>

      {task.status === 'BLOCKED' && task.blocked_reason && (
        <p className="mt-1.5 rounded bg-[var(--alert-crit-soft)] px-1.5 py-1 text-xs text-[var(--alert-crit)]">{task.blocked_reason}</p>
      )}

      {blockingReason !== null && (
        <div className="mt-2 flex flex-col gap-1.5">
          <textarea
            autoFocus
            value={blockingReason}
            onChange={(e) => setBlockingReason(e.target.value)}
            placeholder="Motivo del bloqueo…"
            rows={2}
            className="rounded border border-[var(--border-mid)] px-1.5 py-1 text-xs"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => move('BLOCKED', blockingReason)}
              className="rounded bg-[var(--alert-crit)] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
            >
              Confirmar bloqueo
            </button>
            <button
              type="button"
              onClick={() => setBlockingReason(null)}
              className="rounded border border-[var(--border-mid)] px-2 py-1 text-[11px] text-[var(--text-2)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {blockingReason === null && candidates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {candidates
            .filter((to) => to !== 'COMPLETED' || !task.requires_approval)
            .map((to) => (
              <button
                key={to}
                type="button"
                disabled={pending}
                onClick={() => (to === 'BLOCKED' ? setBlockingReason('') : move(to))}
                className="rounded border border-[var(--border-mid)] px-2 py-1 text-[11px] text-[var(--text-1)] hover:bg-[var(--surface-page)] disabled:opacity-60"
              >
                {MOVE_LABELS[to]}
              </button>
            ))}
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-[var(--alert-crit)]">{error}</p>}
    </div>
  );
}
