'use server';

import { createHmac, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canManageInitiative } from '@/lib/initiatives/permissions';
import { CHOICE_TYPES, type QuestionType } from '@/lib/surveys/types';

export type ActionState = { error: string | null };

async function fetchInitiativeForSurveys(supabase: Awaited<ReturnType<typeof createClient>>, code: string) {
  const { data, error } = await supabase
    .from('initiatives')
    .select('id, code, type, area_id, coordinator_user_id')
    .eq('code', code)
    .maybeSingle();
  if (error || !data) throw new Error('Iniciativa no encontrada o sin acceso.');
  return data;
}

async function requireManager(code: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiativeForSurveys(supabase, code);
  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  if (!canManageInitiative(actor, initiative)) {
    throw new Error('No tienes autoridad para gestionar encuestas de esta iniciativa.');
  }
  return { supabase, initiative, user };
}

async function requireViewer(code: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const initiative = await fetchInitiativeForSurveys(supabase, code);
  return { supabase, initiative, user };
}

/**
 * Hash de deduplicación de respuestas — no identifica a nadie: usa una
 * clave de servidor (nunca expuesta al cliente) para que ni siquiera
 * quien tenga acceso a la tabla pueda probar candidatos de usuario contra
 * los hashes guardados. Solo sirve para bloquear un segundo envío del
 * mismo usuario a la misma encuesta.
 */
function respondentHash(surveyId: string, userId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createHmac('sha256', secret).update(`${surveyId}:${userId}`).digest('hex');
}

export async function createSurvey(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const anonymous = formData.get('anonymous') === 'on';

  if (!title) return { error: 'Ponle un título a la encuesta.' };

  try {
    const { supabase, initiative } = await requireManager(code);
    const { error } = await supabase.from('surveys').insert({
      initiative_id: initiative.id,
      title,
      description: description || null,
      anonymous,
      status: 'DRAFT',
    });
    if (error) return { error: `No se pudo crear la encuesta: ${error.message}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/encuestas`);
  return { error: null };
}

export async function addQuestion(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const surveyId = String(formData.get('surveyId') ?? '');
  const text = String(formData.get('text') ?? '').trim();
  const type = String(formData.get('type') ?? '') as QuestionType;
  const required = formData.get('required') === 'on';
  const optionsRaw = String(formData.get('options') ?? '');

  if (!text) return { error: 'Escribe el texto de la pregunta.' };

  const options = optionsRaw
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);

  if (CHOICE_TYPES.includes(type) && options.length < 2) {
    return { error: 'Las preguntas de opción necesitan al menos 2 opciones (una por línea).' };
  }

  try {
    const { supabase } = await requireManager(code);

    const { data: survey } = await supabase.from('surveys').select('status').eq('id', surveyId).maybeSingle();
    if (survey?.status !== 'DRAFT') {
      return { error: 'Solo se pueden agregar preguntas mientras la encuesta está en borrador.' };
    }

    const { count } = await supabase
      .from('survey_questions')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', surveyId);

    const { error } = await supabase.from('survey_questions').insert({
      survey_id: surveyId,
      text,
      type,
      position: count ?? 0,
      required,
      options: CHOICE_TYPES.includes(type) ? options : null,
    });
    if (error) return { error: `No se pudo agregar la pregunta: ${error.message}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/encuestas`);
  return { error: null };
}

export async function deleteQuestion(code: string, questionId: string): Promise<ActionState> {
  try {
    const { supabase } = await requireManager(code);
    const { error } = await supabase.from('survey_questions').delete().eq('id', questionId);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/encuestas`);
  return { error: null };
}

export async function activateSurvey(code: string, surveyId: string): Promise<ActionState> {
  try {
    const { supabase } = await requireManager(code);

    const { count } = await supabase
      .from('survey_questions')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', surveyId);
    if (!count) return { error: 'Agrega al menos una pregunta antes de activar la encuesta.' };

    const { error } = await supabase
      .from('surveys')
      .update({ status: 'ACTIVE', opens_at: new Date().toISOString() })
      .eq('id', surveyId);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/encuestas`);
  return { error: null };
}

export async function closeSurvey(code: string, surveyId: string): Promise<ActionState> {
  try {
    const { supabase } = await requireManager(code);
    const { error } = await supabase
      .from('surveys')
      .update({ status: 'CLOSED', closes_at: new Date().toISOString() })
      .eq('id', surveyId);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/encuestas`);
  revalidatePath(`/iniciativas/${code}`);
  return { error: null };
}

export async function submitResponse(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('initiativeCode') ?? '');
  const surveyId = String(formData.get('surveyId') ?? '');
  const anonymous = formData.get('anonymous') === 'true';
  const questionIds = formData.getAll('questionId').map(String);
  const questionTypes = formData.getAll('questionType').map(String) as QuestionType[];
  const questionRequired = formData.getAll('questionRequired').map((v) => v === 'true');

  try {
    const { supabase, user } = await requireViewer(code);

    for (let i = 0; i < questionIds.length; i++) {
      if (!questionRequired[i]) continue;
      const values = formData.getAll(`answer_${questionIds[i]}`).filter((v) => String(v).trim() !== '');
      if (values.length === 0) return { error: 'Responde todas las preguntas obligatorias.' };
    }

    // No se pide `.select()` tras el insert: si la encuesta es anónima,
    // respondent_user_id queda null y `survey_responses_select` nunca la
    // hace visible ni a quien la envió — pedir RETURNING chocaría con esa
    // misma política. Por eso el id se genera acá y se reutiliza abajo.
    const responseId = randomUUID();
    const { error: responseError } = await supabase.from('survey_responses').insert({
      id: responseId,
      survey_id: surveyId,
      respondent_user_id: anonymous ? null : user.id,
      respondent_hash: respondentHash(surveyId, user.id),
    });

    if (responseError) {
      if (responseError.code === '23505') {
        return { error: 'Ya enviaste tu respuesta a esta encuesta.' };
      }
      return { error: `No se pudo registrar la respuesta: ${responseError.message}` };
    }

    const answers = questionIds.map((questionId, i) => {
      const type = questionTypes[i];
      const patch: Record<string, unknown> = { response_id: responseId, question_id: questionId };
      if (type === 'NUMERIC' || type === 'SCALE_1_5') {
        const raw = formData.get(`answer_${questionId}`);
        patch.value_number = raw ? Number(raw) : null;
      } else if (type === 'MULTIPLE_CHOICE') {
        patch.value_json = formData.getAll(`answer_${questionId}`).map(String);
      } else {
        patch.value_text = formData.get(`answer_${questionId}`) ? String(formData.get(`answer_${questionId}`)) : null;
      }
      return patch;
    });

    if (answers.length > 0) {
      const { error: answersError } = await supabase.from('survey_answers').insert(answers);
      if (answersError) return { error: `No se pudieron guardar las respuestas: ${answersError.message}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido.' };
  }

  revalidatePath(`/iniciativas/${code}/encuestas`);
  return { error: null };
}
