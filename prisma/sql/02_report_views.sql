-- ERP CINERGIA — Vistas de reporte
--
-- Doble propósito:
--   1. Alimentan los dashboards de Director de Reportes dentro del ERP.
--   2. Son el contrato de datos con Cinergia Core (sistema externo del área
--      de Reportes, stack propio). Cinergia Core consulta SOLO estas vistas,
--      con un rol de Postgres de mínimo privilegio.
--
-- Fuera del contrato, deliberadamente: contenido crudo de Radar y Observaciones,
-- respuestas individuales de encuestas, y gasto real ejecutado (eso lo captura
-- Cinergia Core por su cuenta; aquí solo vive el presupuesto proyectado).

-- ═══════════════════════════════════════════════════════════
-- v_report_initiatives — estado y presupuesto por iniciativa
-- ═══════════════════════════════════════════════════════════

create or replace view public.v_report_initiatives as
select
  i.code,
  a.slug                as area,
  a.name                as area_name,
  i.type,
  i.status,
  i.risk_level,
  i.projected_budget,
  i.planned_date,
  i.planned_end_date,
  i.approved_at,
  i.closed_at,
  i.created_at,
  -- Días entre aprobación y cierre. Null mientras no haya cerrado.
  case
    when i.closed_at is not null and i.approved_at is not null
      then extract(day from i.closed_at - i.approved_at)::int
  end                   as days_to_close
from public.initiatives i
join public.areas a on a.id = i.area_id
where i.status <> 'CANCELLED';

-- ═══════════════════════════════════════════════════════════
-- v_report_actas — campos estructurados de cierre
-- ═══════════════════════════════════════════════════════════

create or replace view public.v_report_actas as
select
  i.code                as initiative_code,
  a.slug                as area,
  i.type,
  ac.version,
  ac.status,
  ac.external_approval_status,
  -- Extraídos del formulario estructurado, no parseados de un documento.
  (ac.input_data ->> 'projectedBudget')::numeric as projected_budget,
  ac.input_data ->> 'venue'                      as venue,
  ac.input_data ->> 'sctrStatus'                 as sctr_status,
  ac.approved_at,
  ac.published_at
from public.actas ac
join public.initiatives i on i.id = ac.initiative_id
join public.areas a on a.id = i.area_id
where ac.status in ('APPROVED', 'PUBLISHED');

-- ═══════════════════════════════════════════════════════════
-- v_report_progress — avance agregado, sin contenido operativo
-- ═══════════════════════════════════════════════════════════

create or replace view public.v_report_progress as
with task_stats as (
  select
    initiative_id,
    count(*)                                             as total_tasks,
    count(*) filter (where status = 'COMPLETED')          as completed_tasks,
    count(*) filter (where status = 'OVERDUE')            as overdue_tasks,
    count(*) filter (where status = 'BLOCKED')            as blocked_tasks,
    count(*) filter (
      where status = 'COMPLETED'
        and (due_date is null or completed_at <= due_date)
    )                                                    as on_time_tasks
  from public.tasks
  where status <> 'CANCELLED'
  group by initiative_id
),
checklist_stats as (
  select
    c.initiative_id,
    count(*) filter (where li.required)                              as required_items,
    count(*) filter (where li.required and li.status = 'DONE')       as required_done
  from public.logistics_checklists c
  join public.logistics_items li on li.checklist_id = c.id
  group by c.initiative_id
),
input_stats as (
  select
    initiative_id,
    count(*)                                              as total_inputs,
    count(*) filter (where status = 'CONVERTED')           as converted_inputs
  from public.initiative_inputs
  group by initiative_id
),
survey_stats as (
  select
    s.initiative_id,
    count(distinct r.id)                                  as response_count,
    round(avg(ans.value_number), 2)                       as avg_score
  from public.surveys s
  join public.survey_responses r on r.survey_id = s.id
  join public.survey_answers ans on ans.response_id = r.id
  join public.survey_questions q on q.id = ans.question_id and q.type = 'SCALE_1_5'
  where s.status = 'CLOSED'
  group by s.initiative_id
)
select
  i.code,
  a.slug as area,
  i.type,
  i.status,
  i.risk_level,
  coalesce(t.total_tasks, 0)     as total_tasks,
  coalesce(t.completed_tasks, 0) as completed_tasks,
  coalesce(t.overdue_tasks, 0)   as overdue_tasks,
  coalesce(t.blocked_tasks, 0)   as blocked_tasks,
  case when coalesce(t.completed_tasks, 0) > 0
    then round(100.0 * t.on_time_tasks / t.completed_tasks, 1)
  end as on_time_pct,
  case when coalesce(c.required_items, 0) > 0
    then round(100.0 * c.required_done / c.required_items, 1)
  end as checklist_pct,
  coalesce(inp.total_inputs, 0)     as radar_inputs,
  case when coalesce(inp.total_inputs, 0) > 0
    then round(100.0 * inp.converted_inputs / inp.total_inputs, 1)
  end as radar_conversion_pct,
  sv.response_count as survey_responses,
  sv.avg_score      as survey_avg_score
from public.initiatives i
join public.areas a on a.id = i.area_id
left join task_stats      t   on t.initiative_id = i.id
left join checklist_stats c   on c.initiative_id = i.id
left join input_stats     inp on inp.initiative_id = i.id
left join survey_stats    sv  on sv.initiative_id = i.id
where i.status <> 'CANCELLED';

-- ═══════════════════════════════════════════════════════════
-- v_report_risk_history — evolución del semáforo en el tiempo
-- ═══════════════════════════════════════════════════════════

create or replace view public.v_report_risk_history as
select
  i.code,
  a.slug as area,
  i.type,
  rs.risk_level,
  rs.computed_at
from public.risk_snapshots rs
join public.initiatives i on i.id = rs.initiative_id
join public.areas a on a.id = i.area_id;

-- ═══════════════════════════════════════════════════════════
-- CIERRE DE ACCESO POR DEFECTO — corrección de seguridad
-- ═══════════════════════════════════════════════════════════
--
-- Una vista corre con los permisos de quien la creó (esta migración usa
-- una conexión con privilegios), no con los del usuario que la consulta.
-- Eso significa que RLS de `initiatives`, `tasks`, etc. NO protege estas
-- vistas: por defecto, Supabase otorga SELECT sobre todo lo nuevo en
-- `public` a los roles `anon` y `authenticated`. Sin este bloque, cualquier
-- Miembro autenticado podría leer datos agregados de las 3 áreas.
--
-- Se cierra el acceso por completo. Quedan solo dos caminos: el rol
-- dedicado de Cinergia Core (documentado abajo) y el backend de nuestra
-- propia app, que usa el service role — el cual ya bypassa RLS por
-- diseño de Supabase — y decide en código si el usuario en sesión es
-- PRESIDENT o REPORTS_DIRECTOR antes de devolver cualquier dato.

revoke all on
  public.v_report_initiatives,
  public.v_report_actas,
  public.v_report_progress,
  public.v_report_risk_history
from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- ROL DE LECTURA PARA CINERGIA CORE
-- ═══════════════════════════════════════════════════════════
--
-- Ejecutar una sola vez, sustituyendo la contraseña por una generada al azar
-- y guardada en el gestor de secretos — nunca en el repositorio.
--
--   create role cinergia_core_reader with login password '<generada-al-azar>';
--   grant usage on schema public to cinergia_core_reader;
--   grant select on
--     public.v_report_initiatives,
--     public.v_report_actas,
--     public.v_report_progress,
--     public.v_report_risk_history
--   to cinergia_core_reader;
--
-- Este rol NO recibe permisos sobre ninguna tabla base. Si Cinergia Core
-- necesita un dato nuevo, se agrega a una vista — nunca se abre una tabla.
