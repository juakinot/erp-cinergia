'use client';

import { useState, useTransition } from 'react';
import { moveTask, assignTask } from './actions';
import { TASK_TRANSITIONS } from '@/lib/tasks/state-machine';
import { PRIORITY_LABELS, PRIORITY_STYLES, type TaskStatus } from '@/lib/tasks/types';
import type { TaskWithExtras } from './page';

const MOVE_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Volver a pendiente',
  IN_PROGRESS: 'Iniciar',
  IN_REVIEW: 'Enviar a revisión',
  BLOCKED: 'Bloquear',
  COMPLETED: 'Completar',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelar',
};

export function TaskCard({
  task,
  initiativeCode,
  areaMembers,
  isManager,
  currentUserId,
}: {
  task: TaskWithExtras;
  initiativeCode: string;
  areaMembers: Array<{ id: string; full_name: string }>;
  isManager: boolean;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockingReason, setBlockingReason] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);

  const canAct = isManager || task.assignee_user_id === currentUserId;
  const candidates = canAct ? TASK_TRANSITIONS[task.status] : [];
  const isCancelled = task.status === 'CANCELLED';

  function move(toStatus: TaskStatus, reason?: string) {
    startTransition(async () => {
      const result = await moveTask(initiativeCode, task.id, toStatus, reason);
      setError(result.error);
      if (!result.error) setBlockingReason(null);
    });
  }

  return (
    <div
      className={`rounded-md border border-[#E8EEF5] p-2.5 text-sm ${isCancelled ? 'opacity-50' : ''}`}
    >
      <p className={`font-medium text-[#003360] ${isCancelled ? 'line-through' : ''}`}>{task.title}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLES[task.priority]}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        {task.due_date && (
          <span className="text-[10px] text-[#5A6B82]">
            {new Date(task.due_date).toLocaleDateString('es-PE')}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-[#5A6B82]">{task.assignee?.full_name ?? 'Sin asignar'}</p>

      {task.status === 'BLOCKED' && task.blocked_reason && (
        <p className="mt-1.5 rounded bg-[#F4D2D5] px-1.5 py-1 text-xs text-[#B4232F]">{task.blocked_reason}</p>
      )}

      {isManager && (
        <div className="mt-1.5">
          {reassigning ? (
            <select
              autoFocus
              defaultValue={task.assignee_user_id ?? ''}
              onBlur={() => setReassigning(false)}
              onChange={(e) => {
                const value = e.target.value || null;
                startTransition(async () => {
                  await assignTask(initiativeCode, task.id, value);
                  setReassigning(false);
                });
              }}
              className="w-full rounded border border-[#D3DDEA] px-1.5 py-1 text-xs"
            >
              <option value="">Sin asignar</option>
              {areaMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={() => setReassigning(true)}
              className="text-[10px] text-[#0066CC] hover:underline"
            >
              Reasignar
            </button>
          )}
        </div>
      )}

      {blockingReason !== null && (
        <div className="mt-2 flex flex-col gap-1.5">
          <textarea
            autoFocus
            value={blockingReason}
            onChange={(e) => setBlockingReason(e.target.value)}
            placeholder="Motivo del bloqueo…"
            rows={2}
            className="rounded border border-[#D3DDEA] px-1.5 py-1 text-xs"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => move('BLOCKED', blockingReason)}
              className="rounded bg-[#B4232F] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
            >
              Confirmar bloqueo
            </button>
            <button
              type="button"
              onClick={() => setBlockingReason(null)}
              className="rounded border border-[#D3DDEA] px-2 py-1 text-[11px] text-[#5A6B82]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {blockingReason === null && candidates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {candidates
            .filter((to) => to !== 'COMPLETED' || isManager || !task.requires_approval)
            .map((to) => (
              <button
                key={to}
                type="button"
                disabled={pending}
                onClick={() => (to === 'BLOCKED' ? setBlockingReason('') : move(to))}
                className="rounded border border-[#D3DDEA] px-2 py-1 text-[11px] text-[#003360] hover:bg-[#F4F7FB] disabled:opacity-60"
              >
                {MOVE_LABELS[to]}
              </button>
            ))}
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-[#B4232F]">{error}</p>}
    </div>
  );
}
