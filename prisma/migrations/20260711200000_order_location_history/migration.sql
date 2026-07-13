-- AlterEnum (idempotent)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LOCATION_UPDATED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "order_location_history" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "previousLatitude" DOUBLE PRECISION,
    "previousLongitude" DOUBLE PRECISION,
    "previousAddress" TEXT,
    "newLatitude" DOUBLE PRECISION,
    "newLongitude" DOUBLE PRECISION,
    "newAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_location_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_location_history_orderId_createdAt_idx"
  ON "order_location_history"("orderId", "createdAt");

CREATE INDEX IF NOT EXISTS "order_location_history_userId_createdAt_idx"
  ON "order_location_history"("userId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_location_history_orderId_fkey'
  ) THEN
    ALTER TABLE "order_location_history"
      ADD CONSTRAINT "order_location_history_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
