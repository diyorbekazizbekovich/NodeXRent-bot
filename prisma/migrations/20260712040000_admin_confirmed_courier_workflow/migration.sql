-- AlterEnum: ADMIN_CONFIRMED for Admin -> Courier handoff
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ADMIN_CONFIRMED';

-- Courier decline tracking for re-queue
CREATE TABLE IF NOT EXISTS "order_courier_rejections" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "courierId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_courier_rejections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_courier_rejections_orderId_courierId_key"
  ON "order_courier_rejections"("orderId", "courierId");

CREATE INDEX IF NOT EXISTS "order_courier_rejections_orderId_idx"
  ON "order_courier_rejections"("orderId");

DO $$ BEGIN
  ALTER TABLE "order_courier_rejections"
    ADD CONSTRAINT "order_courier_rejections_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_courier_rejections"
    ADD CONSTRAINT "order_courier_rejections_courierId_fkey"
    FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
