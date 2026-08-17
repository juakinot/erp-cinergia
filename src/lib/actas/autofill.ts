import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActaField, ActaTemplateDefinition } from './types';
import { autoFilledFields } from './types';

const LIKELIHOOD_LABELS: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' };

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

interface InitiativeForAutofill {
  id: string;
  code: string;
  title: string;
  description: string;
  objective: string;
  modality: string;
  planned_date: string | null;
  planned_end_date: string | null;
  projected_budget: string | null;
  venue: string | null;
  coordinator_user_id: string;
  areas: { name: string; formal_name: string } | null;
  coordinator: { full_name: string } | null;
}

/**
 * Calcula el valor de cada campo que el sistema completa solo (ver
 * `FieldSource` en types.ts). Se corre al crear el acta — el resultado se
 * guarda dentro de `input_data` junto con lo que la persona llene a mano,
 * no se recalcula en cada carga: así el acta queda como una fotografía del
 * momento en que se elaboró, no como una vista que cambia sola después.
 */
export async function computeAutoFilledValues(
  supabase: SupabaseClient,
  initiative: InitiativeForAutofill,
  template: ActaTemplateDefinition
): Promise<Record<string, unknown>> {
  const values: Record<string, unknown> = {};

  const initiativeData = {
    code: initiative.code,
    title: initiative.title,
    description: initiative.description,
    objective: initiative.objective,
    modality: initiative.modality,
    plannedDate: initiative.planned_date,
    plannedEndDate: initiative.planned_end_date,
    projectedBudget: initiative.projected_budget,
    venue: initiative.venue,
    area: { name: initiative.areas?.name ?? '', formalName: initiative.areas?.formal_name ?? '' },
  };

  let teamValue: Array<{ name: string; role: string; isLeader: boolean }> | null = null;
  let risksValue: Array<{ description: string; probability: string; impact: string; mitigation: string }> | null =
    null;
  let milestonesValue: Array<[string, string]> | null = null;

  for (const field of autoFilledFields(template)) {
    if (field.source.kind === 'initiative') {
      values[field.id] = getPath(initiativeData, field.source.path) ?? '';
      continue;
    }
    if (field.source.kind === 'boilerplate') {
      values[field.id] = field.source.text;
      continue;
    }
    if (field.source.kind === 'team') {
      if (!teamValue) teamValue = await computeTeam(supabase, initiative);
      values[field.id] = teamValue;
      continue;
    }
    if (field.source.kind === 'risks') {
      if (!risksValue) risksValue = await computeRisks(supabase, initiative.id);
      values[field.id] = risksValue;
      continue;
    }
    if (field.source.kind === 'milestones') {
      if (!milestonesValue) milestonesValue = await computeMilestones(supabase, initiative.id);
      values[field.id] = milestonesValue;
      continue;
    }
  }

  return values;
}

async function computeTeam(supabase: SupabaseClient, initiative: InitiativeForAutofill) {
  const team: Array<{ name: string; role: string; isLeader: boolean }> = [];
  if (initiative.coordinator?.full_name) {
    team.push({ name: initiative.coordinator.full_name, role: 'Coordinador', isLeader: true });
  }

  const { data: assignees } = await supabase
    .from('tasks')
    .select('assignee_user_id, assignee:assignee_user_id(full_name)')
    .eq('initiative_id', initiative.id)
    .not('assignee_user_id', 'is', null);

  const seen = new Set([initiative.coordinator_user_id]);
  for (const row of (assignees ?? []) as unknown as Array<{
    assignee_user_id: string;
    assignee: { full_name: string } | { full_name: string }[] | null;
  }>) {
    if (seen.has(row.assignee_user_id)) continue;
    seen.add(row.assignee_user_id);
    const name = Array.isArray(row.assignee) ? row.assignee[0]?.full_name : row.assignee?.full_name;
    if (name) team.push({ name, role: 'Miembro del equipo', isLeader: false });
  }

  return team;
}

async function computeRisks(supabase: SupabaseClient, initiativeId: string) {
  const { data } = await supabase
    .from('initiative_risks')
    .select('description, likelihood, impact, mitigation_plan')
    .eq('initiative_id', initiativeId);

  return (data ?? []).map((r: { description: string; likelihood: string; impact: string; mitigation_plan: string | null }) => ({
    description: r.description,
    probability: LIKELIHOOD_LABELS[r.likelihood] ?? r.likelihood,
    impact: LIKELIHOOD_LABELS[r.impact] ?? r.impact,
    mitigation: r.mitigation_plan ?? '',
  }));
}

async function computeMilestones(supabase: SupabaseClient, initiativeId: string): Promise<Array<[string, string]>> {
  const { data } = await supabase
    .from('calendar_items')
    .select('title, starts_at')
    .eq('initiative_id', initiativeId)
    .eq('kind', 'MILESTONE')
    .order('starts_at');

  return (data ?? []).map((m: { title: string; starts_at: string }) => [
    m.title,
    new Date(m.starts_at).toLocaleDateString('es-PE'),
  ]);
}

/** Campos manuales obligatorios sin llenar — bloquea "Enviar a revisión". */
export function missingRequiredFields(template: ActaTemplateDefinition, inputData: Record<string, unknown>): ActaField[] {
  return template.sections
    .flatMap((s) => s.fields)
    .filter((f) => f.source.kind === 'manual' && f.required)
    .filter((f) => {
      const value = inputData[f.id];
      if (value === undefined || value === null) return true;
      if (typeof value === 'string') return value.trim().length === 0;
      if (Array.isArray(value)) return value.length === 0;
      return false;
    });
}
