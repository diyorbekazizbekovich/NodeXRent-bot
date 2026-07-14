-- Order confirmation reminders + confirm metadata
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_CONFIRM_READY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_PRIORITY_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_START_REMINDER';

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isHighPriority" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "order_reminder_logs" (
  "id" SERIAL NOT NULL,
  "orderId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meta" JSONB,
  CONSTRAINT "order_reminder_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_reminder_logs_orderId_kind_key" UNIQUE ("orderId", "kind")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_reminder_logs_orderId_fkey'
  ) THEN
    ALTER TABLE "order_reminder_logs"
      ADD CONSTRAINT "order_reminder_logs_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "order_reminder_logs_kind_sentAt_idx"
  ON "order_reminder_logs" ("kind", "sentAt");

CREATE INDEX IF NOT EXISTS "orders_status_startDatetime_idx"
  ON "orders" (status, "startDatetime");

CREATE INDEX IF NOT EXISTS "orders_isHighPriority_idx"
  ON "orders" ("isHighPriority");
