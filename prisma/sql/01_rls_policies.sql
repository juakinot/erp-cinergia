-- ERP CINERGIA — Row Level Security
-- Aplicar DESPUÉS de `prisma migrate`. Este archivo es idempotente.
--
-- Principio: el aislamiento por área vive aquí, no en la interfaz. Un Director
-- de Marketing no puede leer datos de Proyectos ni llamando la API directamente.
--
-- Alcance por rol:
--   PRESIDENT         → las 3 áreas, sin restricción
--   AREA_DIRECTOR     → solo su área (aprobador primario de su área)
--   REPORTS_DIRECTOR  → NINGUNA tabla operativa cruda; solo las vistas v_report_*
--   COORDINATOR       → su área, con autoridad sobre las iniciativas que coordina
--   MEMBER            → su área, solo donde participa

-- ═══════════════════════════════════════════════════════════
-- FUNCIONES AUXILIARES
-- ═══════════════════════════════════════════════════════════

-- SECURITY DEFINER permite leer public.users sin caer en recursión de políticas.
-- search_path fijo evita secuestro de resolución de nombres.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role::text from public.users where id = auth.uid() and status = 'ACTIVE'
$$;

create or replace function public.current_user_area()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select area_id from public.users where id = auth.uid() and status = 'ACTIVE'
$$;

-- Acceso total a la operación: solo Presidencia.
create or replace function public.is_presidency()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_role() = 'PRESIDENT'
$$;

-- ¿El usuario puede ver esta área? Reportes queda deliberadamente fuera:
-- su acceso cross-área es solo agregado, vía vistas.
create or replace function public.can_access_area(target_area uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_presidency()
    or (
      public.current_user_role() in ('AREA_DIRECTOR', 'COORDINATOR', 'MEMBER')
      and public.current_user_area() = target_area
    )
$$;

-- Autoridad de escritura sobre una iniciativa: Presidencia, el Director del
-- área dueña, o el Coordinador asignado a esa iniciativa.
create or replace function public.can_manage_initiative(initiative_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.initiatives i
    where i.id = initiative_id
      and (
        public.is_presidency()
        or (public.current_user_role() = 'AREA_DIRECTOR' and i.area_id = public.current_user_area())
        or (public.current_user_role() = 'COORDINATOR' and i.coordinator_user_id = auth.uid())
      )
  )
$$;

-- Pertenencia al área de una iniciativa (lectura).
create or replace function public.can_view_initiative(initiative_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.initiatives i
    where i.id = initiative_id and public.can_access_area(i.area_id)
  )
$$;

-- ═══════════════════════════════════════════════════════════
-- ACTIVACIÓN DE RLS
-- ═══════════════════════════════════════════════════════════

alter table public.users                        enable row level security;
alter table public.areas                        enable row level security;
alter table public.initiatives                  enable row level security;
alter table public.initiative_transitions       enable row level security;
alter table public.tasks                        enable row level security;
alter table public.task_transitions             enable row level security;
alter table public.kanban_boards                enable row level security;
alter table public.kanban_columns               enable row level security;
alter table public.kanban_cards                 enable row level security;
alter table public.calendar_items               enable row level security;
alter table public.actas                        enable row level security;
alter table public.acta_templates               enable row level security;
alter table public.logistics_checklists         enable row level security;
alter table public.logistics_items              enable row level security;
alter table public.surveys                      enable row level security;
alter table public.survey_questions             enable row level security;
alter table public.survey_responses             enable row level security;
alter table public.survey_answers               enable row level security;
alter table public.observations                 enable row level security;
alter table public.initiative_inputs            enable row level security;
alter table public.initiative_input_transitions enable row level security;
alter table public.initiative_risks             enable row level security;
alter table public.idea_campaigns               enable row level security;
alter table public.ideas                        enable row level security;
alter table public.idea_votes                   enable row level security;
alter table public.risk_snapshots               enable row level security;
alter table public.improvement_proposals        enable row level security;
alter table public.notifications                enable row level security;
alter table public.notification_preferences     enable row level security;
alter table public.audit_log                    enable row level security;
alter table public.attachments                  enable row level security;
alter table public.app_settings                 enable row level security;

-- ═══════════════════════════════════════════════════════════
-- USUARIOS Y ÁREAS
-- ═══════════════════════════════════════════════════════════

drop policy if exists users_select on public.users;
create policy users_select on public.users for select using (
  id = auth.uid()                                    -- siempre su propio perfil
  or public.is_presidency()                          -- directorio completo
  or public.current_user_role() = 'REPORTS_DIRECTOR' -- headcount agregado por área
  or (public.current_user_role() in ('AREA_DIRECTOR', 'COORDINATOR', 'MEMBER')
      and area_id = public.current_user_area())      -- su propia área
);

-- Solo Presidencia gestiona el directorio; cualquiera edita su propio perfil.
drop policy if exists users_insert on public.users;
create policy users_insert on public.users for insert with check (public.is_presidency());

drop policy if exists users_update on public.users;
create policy users_update on public.users for update using (
  public.is_presidency() or id = auth.uid()
);

-- Catálogo de áreas: legible por cualquier sesión autenticada, escritura vetada.
drop policy if exists areas_select on public.areas;
create policy areas_select on public.areas for select using (auth.uid() is not null);

drop policy if exists areas_write on public.areas;
create policy areas_write on public.areas for all using (public.is_presidency());

-- ═══════════════════════════════════════════════════════════
-- INICIATIVAS
-- ═══════════════════════════════════════════════════════════

drop policy if exists initiatives_select on public.initiatives;
create policy initiatives_select on public.initiatives for select using (
  public.can_access_area(area_id)
);

-- Crear: Presidencia o el Director del área dueña.
drop policy if exists initiatives_insert on public.initiatives;
create policy initiatives_insert on public.initiatives for insert with check (
  public.is_presidency()
  or (public.current_user_role() = 'AREA_DIRECTOR' and area_id = public.current_user_area())
);

-- Editar: Presidencia, Director del área, o el Coordinador asignado.
drop policy if exists initiatives_update on public.initiatives;
create policy initiatives_update on public.initiatives for update using (
  public.is_presidency()
  or (public.current_user_role() = 'AREA_DIRECTOR' and area_id = public.current_user_area())
  or (public.current_user_role() = 'COORDINATOR' and coordinator_user_id = auth.uid())
);

-- Sin DELETE: las iniciativas se cancelan, nunca se borran.

drop policy if exists initiative_transitions_select on public.initiative_transitions;
create policy initiative_transitions_select on public.initiative_transitions for select using (
  public.can_view_initiative(initiative_id)
);

drop policy if exists initiative_transitions_insert on public.initiative_transitions;
create policy initiative_transitions_insert on public.initiative_transitions for insert with check (
  public.can_manage_initiative(initiative_id) and actor_user_id = auth.uid()
);

-- ═══════════════════════════════════════════════════════════
-- TAREAS
-- ═══════════════════════════════════════════════════════════

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (
  public.can_view_initiative(initiative_id)
);

-- Crear tareas es autoridad de quien gestiona la iniciativa (Coordinador+),
-- no de cualquiera que la pueda ver.
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert with check (
  public.can_manage_initiative(initiative_id)
);

-- Editar: quien gestiona la iniciativa, o el asignado sobre su propia tarea.
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update using (
  public.can_manage_initiative(initiative_id)
  or assignee_user_id = auth.uid()
);

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete using (
  public.can_manage_initiative(initiative_id)
);

drop policy if exists task_transitions_select on public.task_transitions;
create policy task_transitions_select on public.task_transitions for select using (
  exists (select 1 from public.tasks t where t.id = task_id and public.can_view_initiative(t.initiative_id))
);

-- Mismo criterio que tasks_update: quien gestiona la iniciativa, o la
-- persona asignada dejando registro de su propio movimiento.
drop policy if exists task_transitions_insert on public.task_transitions;
create policy task_transitions_insert on public.task_transitions for insert with check (
  actor_user_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (public.can_manage_initiative(t.initiative_id) or t.assignee_user_id = auth.uid())
  )
);

-- ═══════════════════════════════════════════════════════════
-- KANBAN · CALENDARIO · LOGÍSTICA (derivan de la iniciativa)
-- ═══════════════════════════════════════════════════════════

-- Lectura: cualquiera que vea la iniciativa. Escritura: quien la gestiona
-- (el tablero y sus columnas son estructura fija, creada automáticamente
-- al aprobar — no algo que un Miembro deba poder tocar).
drop policy if exists kanban_boards_all on public.kanban_boards;
drop policy if exists kanban_boards_select on public.kanban_boards;
create policy kanban_boards_select on public.kanban_boards for select using (
  public.can_view_initiative(initiative_id)
);
drop policy if exists kanban_boards_write on public.kanban_boards;
create policy kanban_boards_write on public.kanban_boards for all using (
  public.can_manage_initiative(initiative_id)
);

drop policy if exists kanban_columns_all on public.kanban_columns;
drop policy if exists kanban_columns_select on public.kanban_columns;
create policy kanban_columns_select on public.kanban_columns for select using (
  exists (select 1 from public.kanban_boards b where b.id = board_id and public.can_view_initiative(b.initiative_id))
);
drop policy if exists kanban_columns_write on public.kanban_columns;
create policy kanban_columns_write on public.kanban_columns for all using (
  exists (select 1 from public.kanban_boards b where b.id = board_id and public.can_manage_initiative(b.initiative_id))
);

-- Las tarjetas sí tienen un autoservicio: la persona asignada a la tarea
-- puede mover su propia tarjeta (mismo criterio que tasks_update), aunque
-- no gestione la iniciativa. Crear/borrar tarjetas queda solo para quien
-- gestiona — nace junto con la tarea, no suelta.
drop policy if exists kanban_cards_all on public.kanban_cards;
drop policy if exists kanban_cards_select on public.kanban_cards;
create policy kanban_cards_select on public.kanban_cards for select using (
  exists (
    select 1 from public.kanban_columns c
    join public.kanban_boards b on b.id = c.board_id
    where c.id = column_id and public.can_view_initiative(b.initiative_id)
  )
);
drop policy if exists kanban_cards_insert on public.kanban_cards;
create policy kanban_cards_insert on public.kanban_cards for insert with check (
  exists (
    select 1 from public.kanban_columns c
    join public.kanban_boards b on b.id = c.board_id
    where c.id = column_id and public.can_manage_initiative(b.initiative_id)
  )
);
drop policy if exists kanban_cards_update on public.kanban_cards;
create policy kanban_cards_update on public.kanban_cards for update using (
  exists (
    select 1 from public.kanban_columns c
    join public.kanban_boards b on b.id = c.board_id
    where c.id = column_id and public.can_manage_initiative(b.initiative_id)
  )
  or exists (select 1 from public.tasks t where t.id = task_id and t.assignee_user_id = auth.uid())
);
drop policy if exists kanban_cards_delete on public.kanban_cards;
create policy kanban_cards_delete on public.kanban_cards for delete using (
  exists (
    select 1 from public.kanban_columns c
    join public.kanban_boards b on b.id = c.board_id
    where c.id = column_id and public.can_manage_initiative(b.initiative_id)
  )
);

drop policy if exists calendar_items_select on public.calendar_items;
create policy calendar_items_select on public.calendar_items for select using (
  (initiative_id is null and visibility in ('TEAM', 'PUBLIC'))
  or (initiative_id is not null and public.can_view_initiative(initiative_id)
      and (visibility <> 'PRIVATE' or created_by_user_id = auth.uid()))
);

drop policy if exists calendar_items_write on public.calendar_items;
create policy calendar_items_write on public.calendar_items for all using (
  public.is_presidency()
  or created_by_user_id = auth.uid()
  or (initiative_id is not null and public.can_manage_initiative(initiative_id))
);

drop policy if exists logistics_checklists_all on public.logistics_checklists;
create policy logistics_checklists_all on public.logistics_checklists for all using (
  public.can_view_initiative(initiative_id)
);

drop policy if exists logistics_items_all on public.logistics_items;
create policy logistics_items_all on public.logistics_items for all using (
  exists (
    select 1 from public.logistics_checklists c
    where c.id = checklist_id and public.can_view_initiative(c.initiative_id)
  )
);

-- ═══════════════════════════════════════════════════════════
-- ACTAS
-- ═══════════════════════════════════════════════════════════

drop policy if exists acta_templates_select on public.acta_templates;
create policy acta_templates_select on public.acta_templates for select using (auth.uid() is not null);

drop policy if exists acta_templates_write on public.acta_templates;
create policy acta_templates_write on public.acta_templates for all using (public.is_presidency());

-- Los Miembros solo ven actas publicadas; el resto del equipo ve cualquier estado.
drop policy if exists actas_select on public.actas;
create policy actas_select on public.actas for select using (
  public.can_view_initiative(initiative_id)
  and (
    public.current_user_role() <> 'MEMBER'
    or status = 'PUBLISHED'
  )
);

drop policy if exists actas_insert on public.actas;
create policy actas_insert on public.actas for insert with check (
  public.can_manage_initiative(initiative_id)
);

drop policy if exists actas_update on public.actas;
create policy actas_update on public.actas for update using (
  public.can_manage_initiative(initiative_id)
);

-- ═══════════════════════════════════════════════════════════
-- ENCUESTAS
-- ═══════════════════════════════════════════════════════════

drop policy if exists surveys_select on public.surveys;
create policy surveys_select on public.surveys for select using (
  public.can_view_initiative(initiative_id)
);

drop policy if exists surveys_write on public.surveys;
create policy surveys_write on public.surveys for all using (
  public.can_manage_initiative(initiative_id)
);

drop policy if exists survey_questions_select on public.survey_questions;
create policy survey_questions_select on public.survey_questions for select using (
  exists (select 1 from public.surveys s where s.id = survey_id and public.can_view_initiative(s.initiative_id))
);

drop policy if exists survey_questions_write on public.survey_questions;
create policy survey_questions_write on public.survey_questions for all using (
  exists (select 1 from public.surveys s where s.id = survey_id and public.can_manage_initiative(s.initiative_id))
);

-- Insertar la propia respuesta sí; leer respuestas individuales NO, ni siquiera
-- para Directores. Los resultados se consumen agregados desde las vistas.
drop policy if exists survey_responses_insert on public.survey_responses;
create policy survey_responses_insert on public.survey_responses for insert with check (
  exists (
    select 1 from public.surveys s
    where s.id = survey_id and s.status = 'ACTIVE' and public.can_view_initiative(s.initiative_id)
  )
);

drop policy if exists survey_responses_select on public.survey_responses;
create policy survey_responses_select on public.survey_responses for select using (
  respondent_user_id = auth.uid()
);

drop policy if exists survey_answers_insert on public.survey_answers;
create policy survey_answers_insert on public.survey_answers for insert with check (
  exists (select 1 from public.survey_responses r where r.id = response_id and r.respondent_user_id = auth.uid())
);

drop policy if exists survey_answers_select on public.survey_answers;
create policy survey_answers_select on public.survey_answers for select using (
  exists (select 1 from public.survey_responses r where r.id = response_id and r.respondent_user_id = auth.uid())
);

-- ═══════════════════════════════════════════════════════════
-- OBSERVACIONES
-- ═══════════════════════════════════════════════════════════

drop policy if exists observations_select on public.observations;
create policy observations_select on public.observations for select using (
  public.can_view_initiative(initiative_id)
  and (
    visibility = 'INTERNAL'
    or public.current_user_role() in ('PRESIDENT', 'AREA_DIRECTOR')
  )
);

-- Los Miembros responden en hilo pero no abren observaciones nuevas.
drop policy if exists observations_insert on public.observations;
create policy observations_insert on public.observations for insert with check (
  author_user_id = auth.uid()
  and public.can_view_initiative(initiative_id)
  and (
    public.current_user_role() <> 'MEMBER'
    or parent_id is not null
  )
);

drop policy if exists observations_update on public.observations;
create policy observations_update on public.observations for update using (
  author_user_id = auth.uid()
  or (public.can_view_initiative(initiative_id)
      and public.current_user_role() in ('PRESIDENT', 'AREA_DIRECTOR'))
);

-- ═══════════════════════════════════════════════════════════
-- RADAR OPERATIVO
-- ═══════════════════════════════════════════════════════════

-- Visibilidad híbrida contenida: el Miembro ve los suyos en cualquier estado,
-- más los aprobados/convertidos del equipo ("Aprendizajes"). No ve los ajenos
-- en PROPOSED, IN_REVIEW ni REJECTED.
drop policy if exists initiative_inputs_select on public.initiative_inputs;
create policy initiative_inputs_select on public.initiative_inputs for select using (
  public.can_view_initiative(initiative_id)
  and (
    author_user_id = auth.uid()
    or public.current_user_role() in ('PRESIDENT', 'AREA_DIRECTOR', 'COORDINATOR')
    or status in ('APPROVED', 'CONVERTED')
  )
);

drop policy if exists initiative_inputs_insert on public.initiative_inputs;
create policy initiative_inputs_insert on public.initiative_inputs for insert with check (
  author_user_id = auth.uid() and public.can_view_initiative(initiative_id)
);

-- Triage y conversión: nunca el Miembro. La distinción entre prevalidar
-- (Coordinador) y aprobar (Director de Área) se aplica en la capa de servicio.
drop policy if exists initiative_inputs_update on public.initiative_inputs;
create policy initiative_inputs_update on public.initiative_inputs for update using (
  public.can_view_initiative(initiative_id)
  and public.current_user_role() in ('PRESIDENT', 'AREA_DIRECTOR', 'COORDINATOR')
);

drop policy if exists input_transitions_select on public.initiative_input_transitions;
create policy input_transitions_select on public.initiative_input_transitions for select using (
  exists (select 1 from public.initiative_inputs i where i.id = input_id and public.can_view_initiative(i.initiative_id))
);

drop policy if exists input_transitions_insert on public.initiative_input_transitions;
create policy input_transitions_insert on public.initiative_input_transitions for insert with check (
  actor_user_id = auth.uid()
  and exists (select 1 from public.initiative_inputs i where i.id = input_id and public.can_view_initiative(i.initiative_id))
);

drop policy if exists initiative_risks_select on public.initiative_risks;
create policy initiative_risks_select on public.initiative_risks for select using (
  public.can_view_initiative(initiative_id)
);

drop policy if exists initiative_risks_write on public.initiative_risks;
create policy initiative_risks_write on public.initiative_risks for all using (
  public.can_manage_initiative(initiative_id)
);

-- ═══════════════════════════════════════════════════════════
-- IDEACIÓN
-- ═══════════════════════════════════════════════════════════

drop policy if exists idea_campaigns_select on public.idea_campaigns;
create policy idea_campaigns_select on public.idea_campaigns for select using (auth.uid() is not null);

drop policy if exists idea_campaigns_write on public.idea_campaigns;
create policy idea_campaigns_write on public.idea_campaigns for all using (public.is_presidency());

-- Durante una campaña activa todos ven todas las ideas de las 3 áreas: es un
-- espacio deliberadamente abierto, distinto al resto del sistema.
drop policy if exists ideas_select on public.ideas;
create policy ideas_select on public.ideas for select using (
  status <> 'DRAFT' or author_user_id = auth.uid()
);

drop policy if exists ideas_insert on public.ideas;
create policy ideas_insert on public.ideas for insert with check (
  author_user_id = auth.uid()
  and exists (select 1 from public.idea_campaigns c where c.id = campaign_id and c.status = 'ACTIVE')
);

drop policy if exists ideas_update on public.ideas;
create policy ideas_update on public.ideas for update using (
  author_user_id = auth.uid()
  or public.is_presidency()
  or (public.current_user_role() = 'AREA_DIRECTOR' and area_id = public.current_user_area())
);

drop policy if exists idea_votes_select on public.idea_votes;
create policy idea_votes_select on public.idea_votes for select using (auth.uid() is not null);

drop policy if exists idea_votes_insert on public.idea_votes;
create policy idea_votes_insert on public.idea_votes for insert with check (
  user_id = auth.uid()
  and not exists (select 1 from public.ideas i where i.id = idea_id and i.author_user_id = auth.uid())
);

drop policy if exists idea_votes_delete on public.idea_votes;
create policy idea_votes_delete on public.idea_votes for delete using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- MÉTRICAS Y PROPUESTAS DE MEJORA
-- ═══════════════════════════════════════════════════════════

-- Reportes sí lee snapshots: son agregados de riesgo, no operación cruda.
drop policy if exists risk_snapshots_select on public.risk_snapshots;
create policy risk_snapshots_select on public.risk_snapshots for select using (
  public.current_user_role() = 'REPORTS_DIRECTOR'
  or public.can_view_initiative(initiative_id)
);

drop policy if exists improvement_proposals_select on public.improvement_proposals;
create policy improvement_proposals_select on public.improvement_proposals for select using (
  public.is_presidency()
  or author_user_id = auth.uid()
  or (public.current_user_role() = 'AREA_DIRECTOR'
      and public.current_user_area() = any(affected_area_ids))
);

drop policy if exists improvement_proposals_insert on public.improvement_proposals;
create policy improvement_proposals_insert on public.improvement_proposals for insert with check (
  author_user_id = auth.uid() and public.current_user_role() = 'REPORTS_DIRECTOR'
);

-- Decide Presidencia; o el Director de Área si la propuesta afecta solo a su área.
drop policy if exists improvement_proposals_update on public.improvement_proposals;
create policy improvement_proposals_update on public.improvement_proposals for update using (
  public.is_presidency()
  or (public.current_user_role() = 'AREA_DIRECTOR'
      and array_length(affected_area_ids, 1) = 1
      and public.current_user_area() = affected_area_ids[1])
);

-- ═══════════════════════════════════════════════════════════
-- NOTIFICACIONES · AUDITORÍA · ADJUNTOS · CONFIGURACIÓN
-- ═══════════════════════════════════════════════════════════

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for all using (user_id = auth.uid());

drop policy if exists notification_prefs_own on public.notification_preferences;
create policy notification_prefs_own on public.notification_preferences for all using (user_id = auth.uid());

-- Auditoría: Presidencia ve todo; Director de Área los últimos 30 días de su
-- área; Coordinador y Miembro solo lo de sus iniciativas.
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select using (
  public.is_presidency()
  or (
    public.current_user_role() = 'AREA_DIRECTOR'
    and occurred_at > now() - interval '30 days'
    and exists (
      select 1 from public.initiatives i
      where i.code = audit_log.initiative_code and i.area_id = public.current_user_area()
    )
  )
  or (
    public.current_user_role() in ('COORDINATOR', 'MEMBER')
    and exists (
      select 1 from public.initiatives i
      where i.code = audit_log.initiative_code and public.can_view_initiative(i.id)
    )
  )
);

-- Append-only: sin políticas de UPDATE ni DELETE. La escritura entra por el
-- trigger de auditoría (SECURITY DEFINER), no por sesiones de usuario.
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert with check (false);

revoke update, delete on public.audit_log from authenticated, anon;

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments for select using (
  status = 'ACTIVE'
  and (
    initiative_id is null
    or public.can_view_initiative(initiative_id)
  )
);

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments for insert with check (
  uploaded_by_user_id = auth.uid()
);

drop policy if exists attachments_update on public.attachments;
create policy attachments_update on public.attachments for update using (
  uploaded_by_user_id = auth.uid()
  or public.is_presidency()
  or (initiative_id is not null and public.can_manage_initiative(initiative_id))
);

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select using (auth.uid() is not null);

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all using (public.is_presidency());
