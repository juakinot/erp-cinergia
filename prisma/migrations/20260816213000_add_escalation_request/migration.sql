-- AlterTable
ALTER TABLE "initiatives" ADD COLUMN "escalation_requested_at" TIMESTAMPTZ(6),
ADD COLUMN "escalation_requested_by_user_id" UUID;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_escalation_requested_by_user_id_fkey" FOREIGN KEY ("escalation_requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
