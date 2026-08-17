'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canManageInitiative } from '@/lib/initiatives/permissions';
import { computeAutoFilledValues, missingRequiredFields } from '@/lib/actas/autofill';
import { validateActaTransition, type ActaStatus } from '@/lib/actas/state-machine';
import { ACTA_TEMPLATES } from '@/lib/actas/templates';
import type { ActaTemplateDefinition } from '@/lib/actas/types';

export type ActionState = { error: string | null };

async function fetchInitiativeForActa(supabase: Awaited<ReturnType<typeof createClient>>, code: string) {
  const { data, error } = await supabase
    .from('initiatives')
    .select(
      'id, code, type, area_id, coordinator_user_id, title, description, objective, modality, planned_date, planned_end_date, projected_budget, venue, areas(name, formal_name), coordinator:coordinator_user_id(full_name)'
    )
    .eq('code', code)
    .maybeSingle();
  if (error || !data) throw new Error('Iniciativa no encontrada o sin acceso.');
  return data as unknown as {
    id: string;
    code: string;
    type: 'EVENT' | 'CAMPAIGN' | 'PROJECT';
    area_id: string;
    coordinator_user_id: string;
    title: string;
    description: string;
    objective: string;
    modality: string;
    planned_date: string | null;
    planned_end_date: string | null;
    projected_budget: string | null;
    venue: string | null;
    areas: { name: string; formal_name: string } | null;
    coordinator: { full_name: string } | null;
  };
}

export async function createActa(code: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiativeForActa(supabase, code);
  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  if (!canManageInitiative(actor, initiative)) {
    return { error: 'No tienes autoridad para crear el acta de esta iniciativa.' };
  }

  const template: ActaTemplateDefinition | undefined = ACTA_TEMPLATES.find(
    (t) => t.initiativeType === initiative.type
  );
  if (!template) return { error: `No hay plantilla de acta para el tipo "${initiative.type}".` };

  const { data: templateRow } = await supabase
    .from('acta_templates')
    .select('id')
    .eq('initiative_type', initiative.type)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!templateRow) return { error: 'La plantilla de acta no está sembrada en la base de datos.' };

  const autoValues = await computeAutoFilledValues(supabase, initiative, template);

  const { error } = await supabase.from('actas').insert({
    initiative_id: initiative.id,
    template_id: templateRow.id,
    title: template.documentTitle,
    input_data: autoValues,
    created_by_user_id: user.id,
  });
  if (error) return { error: `No se pudo crear el acta: ${error.message}` };

  revalidatePath(`/iniciativas/${code}/acta`);
  return { error: null };
}

export async function saveActaDraft(code: string, actaId: string, manualValues: Record<string, unknown>): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiativeForActa(supabase, code);
  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  if (!canManageInitiative(actor, initiative)) {
    return { error: 'No tienes autoridad para editar esta acta.' };
  }

  const { data: acta } = await supabase.from('actas').select('status, input_data').eq('id', actaId).maybeSingle();
  if (!acta) return { error: 'Acta no encontrada o sin acceso.' };
  if (acta.status !== 'DRAFT') return { error: 'Solo se puede editar un acta en borrador.' };

  const merged = { ...(acta.input_data as Record<string, unknown>), ...manualValues };

  const { error } = await supabase.from('actas').update({ input_data: merged }).eq('id', actaId);
  if (error) return { error: error.message };

  revalidatePath(`/iniciativas/${code}/acta`);
  return { error: null };
}

export async function transitionActa(code: string, actaId: string, toStatus: ActaStatus): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiativeForActa(supabase, code);
  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  const isManager = canManageInitiative(actor, initiative);

  const { data: acta } = await supabase
    .from('actas')
    .select('status, input_data, presidency_approved_at')
    .eq('id', actaId)
    .maybeSingle();
  if (!acta) return { error: 'Acta no encontrada o sin acceso.' };

  const template = ACTA_TEMPLATES.find((t) => t.initiativeType === initiative.type);
  if (!template) return { error: `No hay plantilla de acta para el tipo "${initiative.type}".` };

  const missing = missingRequiredFields(template, acta.input_data as Record<string, unknown>);

  const result = validateActaTransition({
    fromStatus: acta.status,
    toStatus,
    actorRole: user.role,
    isManager,
    missingRequiredCount: missing.length,
    requiresPresidencySignature: template.requiresPresidencySignature,
    presidencyApprovedAt: acta.presidency_approved_at,
  });
  if (!result.ok) return { error: result.reason ?? 'Transición no permitida.' };

  const patch: Record<string, unknown> = { status: toStatus };
  const now = new Date().toISOString();
  if (toStatus === 'DRAFT' || toStatus === 'APPROVED') {
    patch.reviewed_by_user_id = user.id;
    patch.reviewed_at = now;
  }
  if (toStatus === 'APPROVED') {
    patch.approved_by_user_id = user.id;
    patch.approved_at = now;
  }
  if (toStatus === 'PUBLISHED') {
    patch.published_at = now;
  }

  const { error } = await supabase.from('actas').update(patch).eq('id', actaId);
  if (error) return { error: error.message };

  revalidatePath(`/iniciativas/${code}/acta`);
  revalidatePath(`/iniciativas/${code}`);
  return { error: null };
}

export async function presidencySign(code: string, actaId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'PRESIDENT') return { error: 'Solo Presidencia puede firmar el acta.' };

  const supabase = await createClient();
  const { data: acta } = await supabase.from('actas').select('status').eq('id', actaId).maybeSingle();
  if (!acta) return { error: 'Acta no encontrada o sin acceso.' };
  if (acta.status !== 'APPROVED') {
    return { error: 'El acta debe estar aprobada internamente antes de la firma de Presidencia.' };
  }

  const { error } = await supabase
    .from('actas')
    .update({ presidency_approved_by_user_id: user.id, presidency_approved_at: new Date().toISOString() })
    .eq('id', actaId);
  if (error) return { error: error.message };

  revalidatePath(`/iniciativas/${code}/acta`);
  revalidatePath(`/iniciativas/${code}`);
  return { error: null };
}
