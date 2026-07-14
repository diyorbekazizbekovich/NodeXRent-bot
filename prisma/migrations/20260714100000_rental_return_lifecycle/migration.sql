-- Rental return lifecycle: new order statuses + rental timing fields

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURN_ASSIGNED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rentalStartAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "expectedReturnAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3);

-- Backfill timing from existing delivery/end fields where possible
UPDATE "orders"
SET
  "rentalStartAt" = COALESCE("rentalStartAt", "deliveryCompletedAt", "startDatetime"),
  "expectedReturnAt" = COALESCE("expectedReturnAt", "endDatetime")
WHERE status IN ('DELIVERED', 'ACTIVE', 'RETURN_REQUESTED', 'EXPIRED', 'RETURNED', 'COMPLETED');

CREATE INDEX IF NOT EXISTS "orders_status_expectedReturnAt_idx"
  ON "orders"("status", "expectedReturnAt");
