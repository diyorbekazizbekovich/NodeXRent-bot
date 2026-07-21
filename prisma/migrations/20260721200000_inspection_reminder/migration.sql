-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "lastInspectionReminderAt" TIMESTAMP(3);
