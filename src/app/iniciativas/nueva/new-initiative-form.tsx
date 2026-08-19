'use client';

import { useActionState, useMemo, useState } from 'react';
import { createInitiative, type ActionState } from '../actions';

interface Area {
  id: string;
  slug: string;
  name: string;
  default_initiative_type: 'EVENT' | 'CAMPAIGN' | 'PROJECT';
}

interface Candidate {
  id: string;
  full_name: string;
  role: string;
  area_id: string | null;
}

const TYPE_LABELS: Record<string, string> = { EVENT: 'Evento', CAMPAIGN: 'Campaña', PROJECT: 'Proyecto' };
const MODALITY_OPTIONS = [
  { value: 'IN_PERSON', label: 'Presencial' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'HYBRID', label: 'Híbrida' },
];

const initialState: ActionState = { error: null };

const inputClass =
  'rounded-md border border-[#D3DDEA] px-3 py-2 text-sm text-[#003360] outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]';
const labelClass = 'text-sm font-medium text-[#003360]';

export default function NewInitiativeForm({
  areas,
  candidates,
  lockedAreaId,
}: {
  areas: Area[];
  candidates: Candidate[];
  lockedAreaId: string | null;
}) {
  const [state, formAction, pending] = useActionState(createInitiative, initialState);
  const [areaId, setAreaId] = useState(lockedAreaId ?? areas[0]?.id ?? '');

  const selectedArea = areas.find((a) => a.id === areaId);
  const coordinatorOptions = useMemo(
    () => candidates.filter((c) => c.area_id === areaId),
    [candidates, areaId]
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Nueva iniciativa</h1>

      <form action={formAction} className="panel flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="areaId" className={labelClass}>
                Área
              </label>
              {/*
                Un <select disabled> no se incluye en el FormData al enviar
                — por eso el valor real viaja en un input oculto aparte, y
                el select visible (sin `name`) solo bloquea la interacción.
              */}
              <select
                id="areaId"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                disabled={Boolean(lockedAreaId)}
                className={inputClass}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input type="hidden" name="areaId" value={areaId} />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Tipo</span>
              <input type="hidden" name="type" value={selectedArea?.default_initiative_type ?? ''} />
              <p className="rounded-md bg-[#F4F7FB] px-3 py-2 text-sm text-[#5A6B82]">
                {selectedArea ? TYPE_LABELS[selectedArea.default_initiative_type] : '—'}
                <span className="ml-1 text-xs">(según el área)</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className={labelClass}>
              Título
            </label>
            <input id="title" name="title" required className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className={labelClass}>
              Descripción
            </label>
            <textarea id="description" name="description" required rows={3} className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="objective" className={labelClass}>
              Objetivo
            </label>
            <textarea id="objective" name="objective" required rows={2} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="modality" className={labelClass}>
                Modalidad
              </label>
              <select id="modality" name="modality" required className={inputClass}>
                {MODALITY_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="plannedDate" className={labelClass}>
                Fecha planificada
              </label>
              <input id="plannedDate" name="plannedDate" type="date" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="projectedBudget" className={labelClass}>
                Presupuesto proyectado (S/)
              </label>
              <input
                id="projectedBudget"
                name="projectedBudget"
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
              />
              <p className="text-xs text-[#5A6B82]">Sobre S/ 2,000 requiere aprobación de Presidencia.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="venue" className={labelClass}>
                Sede / lugar
              </label>
              <input id="venue" name="venue" className={inputClass} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="coordinatorUserId" className={labelClass}>
              Coordinador
            </label>
            <select id="coordinatorUserId" name="coordinatorUserId" required className={inputClass}>
              <option value="">Selecciona…</option>
              {coordinatorOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
            {coordinatorOptions.length === 0 && (
              <p className="text-xs text-[#B4232F]">
                No hay coordinadores registrados en esta área todavía.
              </p>
            )}
          </div>

          {state.error && (
            <p role="alert" className="rounded-md bg-[#F4D2D5] px-3 py-2 text-sm text-[#B4232F]">
              {state.error}
            </p>
          )}

        <button type="submit" disabled={pending} className="btn primary" style={{ width: 'fit-content' }}>
          {pending ? 'Creando…' : 'Crear iniciativa'}
        </button>
      </form>
    </div>
  );
}
