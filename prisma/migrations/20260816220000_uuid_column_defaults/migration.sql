-- AlterTable: agregar DEFAULT gen_random_uuid() a nivel de base de datos
--
-- Prisma's @default(uuid()) genera el UUID en el cliente de Prisma antes de
-- enviar el INSERT — no crea un DEFAULT real en la columna de Postgres. Eso
-- es invisible mientras todo pase por Prisma Client, pero esta app escribe
-- datos operativos vía supabase-js (para que RLS decida, no service_role —
-- ver D7/D9 en decisiones-tecnicas.md), y ese camino no tiene forma de
-- generar el UUID del lado del cliente. Sin este DEFAULT, cualquier insert
-- vía supabase-js falla con "null value in column id".
--
-- gen_random_uuid() ya está disponible (pgcrypto activado desde el inicio
-- del proyecto).

ALTER TABLE "areas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "initiatives" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "initiative_transitions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "tasks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "task_transitions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "kanban_boards" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "kanban_columns" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "kanban_cards" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "calendar_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "acta_templates" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "actas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "logistics_checklists" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "logistics_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "surveys" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "survey_questions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "survey_responses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "survey_answers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "observations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "initiative_inputs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "initiative_input_transitions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "initiative_risks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "idea_campaigns" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "ideas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "idea_votes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "risk_snapshots" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "improvement_proposals" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "notifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "notification_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "audit_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "attachments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
