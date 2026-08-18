import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canManageInitiative } from '@/lib/initiatives/permissions';
import type { SurveyQuestionRow, SurveyRow } from '@/lib/surveys/types';
import { AppShell } from '@/components/app-shell';
import { Breadcrumb } from '@/components/breadcrumb';
import { CreateSurveyForm } from './create-survey-form';
import { SurveyBuilder } from './survey-builder';
import { ResponseForm } from './response-form';
import { CloseSurveyButton } from './close-survey-button';

export default async function SurveysPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('id, code, title, type, area_id, coordinator_user_id')
    .eq('code', code)
    .maybeSingle();

  if (!initiative) notFound();

  const row = initiative as {
    id: string;
    code: string;
    title: string;
    type: 'EVENT' | 'CAMPAIGN' | 'PROJECT';
    area_id: string;
    coordinator_user_id: string;
  };

  const actor = { id: user.id, role: user.role, areaId: user.areaId };
  const isManager = canManageInitiative(actor, row);

  const { data: survey } = await supabase
    .from('surveys')
    .select('id, initiative_id, title, description, status, anonymous, opens_at, closes_at')
    .eq('initiative_id', row.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const surveyRow = survey as SurveyRow | null;

  const { data: questions } = surveyRow
    ? await supabase
        .from('survey_questions')
        .select('id, survey_id, text, type, position, required, options')
        .eq('survey_id', surveyRow.id)
        .order('position')
    : { data: null };

  const questionRows = (questions ?? []) as SurveyQuestionRow[];

  return (
    <AppShell user={user} active="/iniciativas">
      <Breadcrumb backHref={`/iniciativas/${row.code}`} backLabel={row.code} code="Encuesta" />
      <h1 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{row.title}</h1>

      {row.type !== 'EVENT' && (
        <div className="empty" style={{ marginBottom: 20 }}>
          La encuesta post-evento es parte del ciclo de Eventos — esta iniciativa es de tipo distinto, así que no
          bloquea ninguna transición, pero puedes usarla igual si te sirve para recoger feedback.
        </div>
      )}

      {!surveyRow || surveyRow.status === 'CLOSED' ? (
        <div className="flex flex-col gap-4">
          {surveyRow && (
            <div className="panel">
              <div className="panel-head">
                <span>{surveyRow.title}</span>
                <span className="badge b-neutral">Cerrada</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Esta encuesta ya está cerrada. Los resultados se consultan de forma agregada desde el dashboard de
                Reportes (aún no implementado). {isManager && 'Puedes crear una nueva encuesta si necesitas otra ronda.'}
              </p>
            </div>
          )}
          {isManager ? (
            <div className="panel">
              <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-2)' }}>
                {surveyRow ? 'Crear una nueva encuesta' : 'Todavía no existe una encuesta para esta iniciativa.'}
              </p>
              <CreateSurveyForm initiativeCode={row.code} />
            </div>
          ) : (
            !surveyRow && (
              <div className="empty">Todavía no existe una encuesta para esta iniciativa.</div>
            )
          )}
        </div>
      ) : surveyRow.status === 'DRAFT' ? (
        isManager ? (
          <SurveyBuilder initiativeCode={row.code} survey={surveyRow} questions={questionRows} />
        ) : (
          <div className="empty">La encuesta todavía no está activa.</div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {isManager && (
            <div className="panel">
              <div className="panel-head">
                <span>Gestión</span>
                <span className="badge b-verde">Activa</span>
              </div>
              <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-2)' }}>
                {questionRows.length} pregunta(s) · {surveyRow.anonymous ? 'Anónima' : 'Identificada'}. Los resultados
                individuales no son visibles ni para quien gestiona — se consumen agregados desde Reportes. Cierra la
                encuesta cuando quieras dejar de recibir respuestas; esto es lo que desbloquea el cierre del Evento.
              </p>
              <CloseSurveyButton initiativeCode={row.code} surveyId={surveyRow.id} />
            </div>
          )}
          <ResponseForm initiativeCode={row.code} survey={surveyRow} questions={questionRows} />
        </div>
      )}
    </AppShell>
  );
}
