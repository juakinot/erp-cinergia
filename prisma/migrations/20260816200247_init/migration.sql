-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PRESIDENT', 'AREA_DIRECTOR', 'REPORTS_DIRECTOR', 'COORDINATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "AreaSlug" AS ENUM ('EVENTS', 'MARKETING', 'PROJECTS');

-- CreateEnum
CREATE TYPE "InitiativeType" AS ENUM ('EVENT', 'CAMPAIGN', 'PROJECT');

-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('IDEA', 'PROPOSAL', 'APPROVED', 'PLANNING', 'READY', 'EXECUTION', 'POST_EVENT', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EscalationReason" AS ENUM ('BUDGET_THRESHOLD', 'CROSS_AREA', 'DIRECTOR_REQUEST');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('IN_PERSON', 'VIRTUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActaStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ExternalApprovalStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "LogisticsItemStatus" AS ENUM ('PENDING', 'DONE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ObservationVisibility" AS ENUM ('INTERNAL', 'DIRECTION');

-- CreateEnum
CREATE TYPE "InputKind" AS ENUM ('TASK_SUGGESTION', 'RISK_ALERT', 'LOGISTICS_NEED', 'OPERATIONAL_NOTE', 'DATE_ADJUSTMENT', 'OWNER_CHANGE', 'FINDING', 'IMPROVEMENT', 'SUPPORT_REQUEST', 'QUICK_IDEA');

-- CreateEnum
CREATE TYPE "InputStatus" AS ENUM ('PROPOSED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConvertedToType" AS ENUM ('TASK', 'RISK', 'LOGISTICS_ITEM', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('ACTIVE', 'MITIGATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LikelihoodImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PROMOTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('DUE_DATES', 'APPROVALS', 'RADAR', 'INITIATIVES', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('ACTIVE', 'DELETED', 'PURGED');

-- CreateEnum
CREATE TYPE "CalendarItemKind" AS ENUM ('MILESTONE', 'MEETING', 'DELIVERY', 'EXECUTION');

-- CreateEnum
CREATE TYPE "CalendarVisibility" AS ENUM ('PRIVATE', 'TEAM', 'PUBLIC');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SCALE_1_5', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'OPEN_TEXT', 'NUMERIC');

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "slug" "AreaSlug" NOT NULL,
    "name" TEXT NOT NULL,
    "formal_name" TEXT NOT NULL,
    "default_initiative_type" "InitiativeType" NOT NULL,
    "code_prefix" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "area_id" UUID,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiatives" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "InitiativeType" NOT NULL,
    "area_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "modality" "Modality" NOT NULL,
    "status" "InitiativeStatus" NOT NULL DEFAULT 'PROPOSAL',
    "planned_date" TIMESTAMPTZ(6),
    "planned_end_date" TIMESTAMPTZ(6),
    "projected_budget" DECIMAL(10,2),
    "venue" TEXT,
    "sctr_status" TEXT,
    "coordinator_user_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "escalation_reason" "EscalationReason",
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'GREEN',
    "risk_last_computed_at" TIMESTAMPTZ(6),
    "cancelled_reason" TEXT,
    "closed_at" TIMESTAMPTZ(6),
    "source_idea_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative_transitions" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "from_status" "InitiativeStatus",
    "to_status" "InitiativeStatus" NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "validation_snapshot" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "assignee_user_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "due_date" TIMESTAMPTZ(6),
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "blocked_reason" TEXT,
    "blocked_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "source_input_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_transitions" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "from_status" "TaskStatus",
    "to_status" "TaskStatus" NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_boards" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_columns" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "position" INTEGER NOT NULL,
    "wip_limit" INTEGER,

    CONSTRAINT "kanban_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_cards" (
    "id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "kanban_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_items" (
    "id" UUID NOT NULL,
    "initiative_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "kind" "CalendarItemKind" NOT NULL,
    "visibility" "CalendarVisibility" NOT NULL DEFAULT 'TEAM',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acta_templates" (
    "id" UUID NOT NULL,
    "initiative_type" "InitiativeType" NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "structure_schema" JSONB NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acta_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actas" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "status" "ActaStatus" NOT NULL DEFAULT 'DRAFT',
    "input_data" JSONB NOT NULL,
    "generated_content" TEXT,
    "ai_model" TEXT,
    "ai_prompt_version" TEXT,
    "external_approval_status" "ExternalApprovalStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "created_by_user_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "presidency_approved_by_user_id" UUID,
    "presidency_approved_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "pdf_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "actas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_checklists" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_items" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "needs_evidence" BOOLEAN NOT NULL DEFAULT false,
    "status" "LogisticsItemStatus" NOT NULL DEFAULT 'PENDING',
    "done_by_user_id" UUID,
    "done_at" TIMESTAMPTZ(6),
    "not_applicable_reason" TEXT,
    "source_input_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "logistics_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "anonymous" BOOLEAN NOT NULL DEFAULT true,
    "opens_at" TIMESTAMPTZ(6),
    "closes_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "position" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "respondent_user_id" UUID,
    "respondent_hash" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_answers" (
    "id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "value_number" DECIMAL(10,2),
    "value_text" TEXT,
    "value_json" JSONB,

    CONSTRAINT "survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "ObservationVisibility" NOT NULL DEFAULT 'INTERNAL',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ(6),
    "parent_id" UUID,
    "source_input_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative_inputs" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "kind" "InputKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "InputStatus" NOT NULL DEFAULT 'PROPOSED',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "duplicate_of_id" UUID,
    "converted_to_type" "ConvertedToType",
    "converted_to_id" UUID,
    "converted_by_user_id" UUID,
    "converted_at" TIMESTAMPTZ(6),
    "rejected_reason" TEXT,
    "escalated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "initiative_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative_input_transitions" (
    "id" UUID NOT NULL,
    "input_id" UUID NOT NULL,
    "from_status" "InputStatus",
    "to_status" "InputStatus" NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_input_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative_risks" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "likelihood" "LikelihoodImpact" NOT NULL,
    "impact" "LikelihoodImpact" NOT NULL,
    "mitigation_plan" TEXT,
    "owner_user_id" UUID,
    "status" "RiskStatus" NOT NULL DEFAULT 'ACTIVE',
    "source_input_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "initiative_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_campaigns" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'SCHEDULED',
    "opens_at" TIMESTAMPTZ(6) NOT NULL,
    "closes_at" TIMESTAMPTZ(6) NOT NULL,
    "vote_threshold" INTEGER NOT NULL DEFAULT 5,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "modality" "Modality" NOT NULL,
    "status" "IdeaStatus" NOT NULL DEFAULT 'DRAFT',
    "discarded_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_votes" (
    "id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_snapshots" (
    "id" UUID NOT NULL,
    "initiative_id" UUID NOT NULL,
    "risk_level" "RiskLevel" NOT NULL,
    "reasons" JSONB,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "improvement_proposals" (
    "id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "affected_area_ids" UUID[],
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decision_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "improvement_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "kind" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link_path" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "email_sent_at" TIMESTAMPTZ(6),
    "whatsapp_sent_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID,
    "initiative_code" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "ip" INET,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploaded_by_user_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "initiative_id" UUID,
    "task_id" UUID,
    "acta_id" UUID,
    "logistics_item_id" UUID,
    "input_id" UUID,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_slug_key" ON "areas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_area_id_idx" ON "users"("role", "area_id");

-- CreateIndex
CREATE INDEX "users_area_id_status_idx" ON "users"("area_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "initiatives_code_key" ON "initiatives"("code");

-- CreateIndex
CREATE UNIQUE INDEX "initiatives_source_idea_id_key" ON "initiatives"("source_idea_id");

-- CreateIndex
CREATE INDEX "initiatives_area_id_status_idx" ON "initiatives"("area_id", "status");

-- CreateIndex
CREATE INDEX "initiatives_status_planned_date_idx" ON "initiatives"("status", "planned_date");

-- CreateIndex
CREATE INDEX "initiatives_risk_level_status_idx" ON "initiatives"("risk_level", "status");

-- CreateIndex
CREATE UNIQUE INDEX "initiatives_type_year_sequence_key" ON "initiatives"("type", "year", "sequence");

-- CreateIndex
CREATE INDEX "initiative_transitions_initiative_id_created_at_idx" ON "initiative_transitions"("initiative_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_source_input_id_key" ON "tasks"("source_input_id");

-- CreateIndex
CREATE INDEX "tasks_initiative_id_status_idx" ON "tasks"("initiative_id", "status");

-- CreateIndex
CREATE INDEX "tasks_assignee_user_id_status_due_date_idx" ON "tasks"("assignee_user_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "tasks_status_due_date_idx" ON "tasks"("status", "due_date");

-- CreateIndex
CREATE INDEX "task_transitions_task_id_created_at_idx" ON "task_transitions"("task_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "kanban_boards_initiative_id_key" ON "kanban_boards"("initiative_id");

-- CreateIndex
CREATE UNIQUE INDEX "kanban_columns_board_id_position_key" ON "kanban_columns"("board_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "kanban_cards_task_id_key" ON "kanban_cards"("task_id");

-- CreateIndex
CREATE INDEX "kanban_cards_column_id_position_idx" ON "kanban_cards"("column_id", "position");

-- CreateIndex
CREATE INDEX "calendar_items_initiative_id_starts_at_idx" ON "calendar_items"("initiative_id", "starts_at");

-- CreateIndex
CREATE INDEX "calendar_items_starts_at_kind_idx" ON "calendar_items"("starts_at", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "acta_templates_initiative_type_version_key" ON "acta_templates"("initiative_type", "version");

-- CreateIndex
CREATE INDEX "actas_initiative_id_status_idx" ON "actas"("initiative_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "actas_initiative_id_version_key" ON "actas"("initiative_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_checklists_initiative_id_key" ON "logistics_checklists"("initiative_id");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_items_source_input_id_key" ON "logistics_items"("source_input_id");

-- CreateIndex
CREATE INDEX "logistics_items_checklist_id_status_idx" ON "logistics_items"("checklist_id", "status");

-- CreateIndex
CREATE INDEX "surveys_initiative_id_status_idx" ON "surveys"("initiative_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "survey_questions_survey_id_position_key" ON "survey_questions"("survey_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_survey_id_respondent_hash_key" ON "survey_responses"("survey_id", "respondent_hash");

-- CreateIndex
CREATE UNIQUE INDEX "survey_answers_response_id_question_id_key" ON "survey_answers"("response_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "observations_source_input_id_key" ON "observations"("source_input_id");

-- CreateIndex
CREATE INDEX "observations_initiative_id_visibility_resolved_idx" ON "observations"("initiative_id", "visibility", "resolved");

-- CreateIndex
CREATE INDEX "initiative_inputs_initiative_id_status_priority_idx" ON "initiative_inputs"("initiative_id", "status", "priority");

-- CreateIndex
CREATE INDEX "initiative_inputs_status_created_at_idx" ON "initiative_inputs"("status", "created_at");

-- CreateIndex
CREATE INDEX "initiative_inputs_author_user_id_status_idx" ON "initiative_inputs"("author_user_id", "status");

-- CreateIndex
CREATE INDEX "initiative_input_transitions_input_id_created_at_idx" ON "initiative_input_transitions"("input_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "initiative_risks_source_input_id_key" ON "initiative_risks"("source_input_id");

-- CreateIndex
CREATE INDEX "initiative_risks_initiative_id_status_impact_idx" ON "initiative_risks"("initiative_id", "status", "impact");

-- CreateIndex
CREATE INDEX "idea_campaigns_status_opens_at_idx" ON "idea_campaigns"("status", "opens_at");

-- CreateIndex
CREATE INDEX "ideas_campaign_id_status_idx" ON "ideas"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "ideas_area_id_status_idx" ON "ideas"("area_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "idea_votes_idea_id_user_id_key" ON "idea_votes"("idea_id", "user_id");

-- CreateIndex
CREATE INDEX "risk_snapshots_initiative_id_computed_at_idx" ON "risk_snapshots"("initiative_id", "computed_at");

-- CreateIndex
CREATE INDEX "risk_snapshots_computed_at_idx" ON "risk_snapshots"("computed_at");

-- CreateIndex
CREATE INDEX "improvement_proposals_status_created_at_idx" ON "improvement_proposals"("status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_kind_subject_id_key" ON "notifications"("user_id", "kind", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_channel_category_key" ON "notification_preferences"("user_id", "channel", "category");

-- CreateIndex
CREATE INDEX "audit_log_subject_type_subject_id_occurred_at_idx" ON "audit_log"("subject_type", "subject_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_initiative_code_occurred_at_idx" ON "audit_log"("initiative_code", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log"("occurred_at");

-- CreateIndex
CREATE INDEX "attachments_initiative_id_status_idx" ON "attachments"("initiative_id", "status");

-- CreateIndex
CREATE INDEX "attachments_status_deleted_at_idx" ON "attachments"("status", "deleted_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_coordinator_user_id_fkey" FOREIGN KEY ("coordinator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_source_idea_id_fkey" FOREIGN KEY ("source_idea_id") REFERENCES "ideas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_transitions" ADD CONSTRAINT "initiative_transitions_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_transitions" ADD CONSTRAINT "initiative_transitions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_input_id_fkey" FOREIGN KEY ("source_input_id") REFERENCES "initiative_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transitions" ADD CONSTRAINT "task_transitions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transitions" ADD CONSTRAINT "task_transitions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_boards" ADD CONSTRAINT "kanban_boards_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_columns" ADD CONSTRAINT "kanban_columns_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "kanban_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_cards" ADD CONSTRAINT "kanban_cards_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "kanban_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_cards" ADD CONSTRAINT "kanban_cards_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas" ADD CONSTRAINT "actas_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas" ADD CONSTRAINT "actas_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "acta_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas" ADD CONSTRAINT "actas_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas" ADD CONSTRAINT "actas_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas" ADD CONSTRAINT "actas_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actas" ADD CONSTRAINT "actas_presidency_approved_by_user_id_fkey" FOREIGN KEY ("presidency_approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_checklists" ADD CONSTRAINT "logistics_checklists_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_items" ADD CONSTRAINT "logistics_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "logistics_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_items" ADD CONSTRAINT "logistics_items_done_by_user_id_fkey" FOREIGN KEY ("done_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_items" ADD CONSTRAINT "logistics_items_source_input_id_fkey" FOREIGN KEY ("source_input_id") REFERENCES "initiative_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_respondent_user_id_fkey" FOREIGN KEY ("respondent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_input_id_fkey" FOREIGN KEY ("source_input_id") REFERENCES "initiative_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_inputs" ADD CONSTRAINT "initiative_inputs_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_inputs" ADD CONSTRAINT "initiative_inputs_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_inputs" ADD CONSTRAINT "initiative_inputs_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_inputs" ADD CONSTRAINT "initiative_inputs_converted_by_user_id_fkey" FOREIGN KEY ("converted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_inputs" ADD CONSTRAINT "initiative_inputs_duplicate_of_id_fkey" FOREIGN KEY ("duplicate_of_id") REFERENCES "initiative_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_input_transitions" ADD CONSTRAINT "initiative_input_transitions_input_id_fkey" FOREIGN KEY ("input_id") REFERENCES "initiative_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_input_transitions" ADD CONSTRAINT "initiative_input_transitions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_risks" ADD CONSTRAINT "initiative_risks_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_risks" ADD CONSTRAINT "initiative_risks_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_risks" ADD CONSTRAINT "initiative_risks_source_input_id_fkey" FOREIGN KEY ("source_input_id") REFERENCES "initiative_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_campaigns" ADD CONSTRAINT "idea_campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "idea_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_votes" ADD CONSTRAINT "idea_votes_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_votes" ADD CONSTRAINT "idea_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_snapshots" ADD CONSTRAINT "risk_snapshots_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_proposals" ADD CONSTRAINT "improvement_proposals_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_proposals" ADD CONSTRAINT "improvement_proposals_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_acta_id_fkey" FOREIGN KEY ("acta_id") REFERENCES "actas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_logistics_item_id_fkey" FOREIGN KEY ("logistics_item_id") REFERENCES "logistics_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_input_id_fkey" FOREIGN KEY ("input_id") REFERENCES "initiative_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
