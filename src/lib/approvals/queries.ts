import type { SupabaseClient } from '@supabase/supabase-js';
import { getEscalationThreshold } from '@/lib/initiatives/state-machine';
import { ACTA_TEMPLATES } from '@/lib/actas/templates';
import type { AppRole } from '@/lib/initiatives/types';

export interface PendingInitiative {
  id: string;
  code: string;
  title: string;
  type: 'EVENT' | 'CAMPAIGN' | 'PROJECT';
  area_id: string;
  area_name: string;
  projected_budget: string | null;
  escalation_requested_at: string | null;
  created_at: string;
}

export interface PendingActa {
  id: string;
  initiative_id: string;
  initiative_code: string;
  initiative_title: string;
  status: 'REVIEW' | 'APPROVED';
  needs: 'REVIEW' | 'SIGNATURE';
  created_at: string;
}

export interface PendingRadarInput {
  id: string;
  initiative_id: string;
  initiative_code: string;
  initiative_title: string;
  title: string;
  kind: string;
  priority: string;
  created_at: string;
}

export interface PendingApprovals {
  initiatives: PendingInitiative[];
  actas: PendingActa[];
  radarInputs: PendingRadarInput[];
}

const EMPTY: PendingApprovals = { initiatives: [], actas: [], radarInputs: [] };

/**
 * Bandeja de aprobaciones — Director de Área ve lo que le corresponde
 * decidir a él dentro de su autoridad (Nota A del wireframe v3); Presidencia
 * ve solo lo que ya escaló. No hay un tercer caso: Coordinador/Miembro
 * nunca aprueban nada acá (mismo principio que canApproveInput del Radar).
 */
export async function getPendingApprovals(
  supabase: SupabaseClient,
  actor: { id: string; role: AppRole; areaId: string | null }
): Promise<PendingApprovals> {
  if (actor.role === 'AREA_DIRECTOR' && actor.areaId) {
    return getForAreaDirector(supabase, actor.areaId);
  }
  if (actor.role === 'PRESIDENT') {
    return getForPresident(supabase);
  }
  return EMPTY;
}

async function getForAreaDirector(supabase: SupabaseClient, areaId: string): Promise<PendingApprovals> {
  const threshold = await getEscalationThreshold(supabase);

  const { data: initiativeRows } = await supabase
    .from('initiatives')
    .select('id, code, title, type, area_id, projected_budget, escalation_requested_at, created_at, areas(name)')
    .eq('status', 'PROPOSAL')
    .eq('area_id', areaId);

  const initiatives = ((initiativeRows ?? []) as unknown as RawInitiative[])
    .filter((i) => !i.escalation_requested_at && (!i.projected_budget || Number(i.projected_budget) <= threshold))
    .map(mapInitiative);

  const { data: actaRows } = await supabase
    .from('actas')
    .select('id, initiative_id, status, created_at, initiatives!inner(code, title, area_id)')
    .eq('status', 'REVIEW')
    .eq('initiatives.area_id', areaId);

  const actas = ((actaRows ?? []) as unknown as RawActa[]).map((a) => mapActa(a, 'REVIEW'));

  const { data: radarRows } = await supabase
    .from('initiative_inputs')
    .select('id, initiative_id, title, kind, priority, created_at, initiatives!inner(code, title, area_id)')
    .eq('status', 'IN_REVIEW')
    .eq('initiatives.area_id', areaId);

  const radarInputs = ((radarRows ?? []) as unknown as RawRadar[]).map(mapRadar);

  return { initiatives, actas, radarInputs };
}

async function getForPresident(supabase: SupabaseClient): Promise<PendingApprovals> {
  const threshold = await getEscalationThreshold(supabase);

  const { data: initiativeRows } = await supabase
    .from('initiatives')
    .select('id, code, title, type, area_id, projected_budget, escalation_requested_at, created_at, areas(name)')
    .eq('status', 'PROPOSAL');

  const initiatives = ((initiativeRows ?? []) as unknown as RawInitiative[])
    .filter((i) => Boolean(i.escalation_requested_at) || (i.projected_budget !== null && Number(i.projected_budget) > threshold))
    .map(mapInitiative);

  // Firma de Presidencia: acta ya aprobada internamente, cuya plantilla la
  // exige, y que todavía no la tiene — no es lo mismo que "en revisión".
  const typesNeedingSignature = ACTA_TEMPLATES.filter((t) => t.requiresPresidencySignature).map(
    (t) => t.initiativeType
  );

  let actas: PendingActa[] = [];
  if (typesNeedingSignature.length > 0) {
    const { data: actaRows } = await supabase
      .from('actas')
      .select('id, initiative_id, status, created_at, presidency_approved_at, initiatives!inner(code, title, type, area_id)')
      .eq('status', 'APPROVED')
      .is('presidency_approved_at', null)
      .in('initiatives.type', typesNeedingSignature);
    actas = ((actaRows ?? []) as unknown as RawActa[]).map((a) => mapActa(a, 'SIGNATURE'));
  }

  // Radar: la única señal de escalación hoy es `escalated_at` (cron #20 de
  // auto-escalado por >48h sin atender), que todavía no corre — esta
  // sección queda honestamente vacía hasta que ese job exista.
  const { data: radarRows } = await supabase
    .from('initiative_inputs')
    .select('id, initiative_id, title, kind, priority, created_at, initiatives!inner(code, title)')
    .eq('status', 'IN_REVIEW')
    .not('escalated_at', 'is', null);

  const radarInputs = ((radarRows ?? []) as unknown as RawRadar[]).map(mapRadar);

  return { initiatives, actas, radarInputs };
}

interface RawInitiative {
  id: string;
  code: string;
  title: string;
  type: 'EVENT' | 'CAMPAIGN' | 'PROJECT';
  area_id: string;
  projected_budget: string | null;
  escalation_requested_at: string | null;
  created_at: string;
  areas: { name: string } | { name: string }[] | null;
}

interface RawActa {
  id: string;
  initiative_id: string;
  status: string;
  created_at: string;
  initiatives:
    | { code: string; title: string; area_id?: string; type?: string }
    | { code: string; title: string; area_id?: string; type?: string }[]
    | null;
}

interface RawRadar {
  id: string;
  initiative_id: string;
  title: string;
  kind: string;
  priority: string;
  created_at: string;
  initiatives: { code: string; title: string } | { code: string; title: string }[] | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapInitiative(row: RawInitiative): PendingInitiative {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    type: row.type,
    area_id: row.area_id,
    area_name: one(row.areas)?.name ?? '—',
    projected_budget: row.projected_budget,
    escalation_requested_at: row.escalation_requested_at,
    created_at: row.created_at,
  };
}

function mapActa(row: RawActa, needs: 'REVIEW' | 'SIGNATURE'): PendingActa {
  const init = one(row.initiatives);
  return {
    id: row.id,
    initiative_id: row.initiative_id,
    initiative_code: init?.code ?? '—',
    initiative_title: init?.title ?? '—',
    status: row.status as 'REVIEW' | 'APPROVED',
    needs,
    created_at: row.created_at,
  };
}

function mapRadar(row: RawRadar): PendingRadarInput {
  const init = one(row.initiatives);
  return {
    id: row.id,
    initiative_id: row.initiative_id,
    initiative_code: init?.code ?? '—',
    initiative_title: init?.title ?? '—',
    title: row.title,
    kind: row.kind,
    priority: row.priority,
    created_at: row.created_at,
  };
}

export function pendingCount(p: PendingApprovals): number {
  return p.initiatives.length + p.actas.length + p.radarInputs.length;
}
