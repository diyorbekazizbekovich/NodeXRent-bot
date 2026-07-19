-- Persistent delivery (handover) wizard state

CREATE TYPE "DeliverySessionStep" AS ENUM (
  'JOYSTICKS',
  'HDMI',
  'POWER',
  'COLLATERAL',
  'COLLATERAL_CONFIRM',
  'PAYMENT',
  'PHOTO',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "DeliverySessionStatus" AS ENUM (
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE IF NOT EXISTS "delivery_sessions" (
  "id" SERIAL NOT NULL,
  "orderId" INTEGER NOT NULL,
  "courierId" INTEGER NOT NULL,
  "inventoryUnitId" INTEGER,
  "consoleItemId" INTEGER,
  "selectedJoystickIds" JSONB NOT NULL DEFAULT '[]',
  "selectedHdmiId" INTEGER,
  "selectedPowerId" INTEGER,
  "documentType" TEXT,
  "paymentMethod" TEXT,
  "currentStep" "DeliverySessionStep" NOT NULL DEFAULT 'JOYSTICKS',
  "status" "DeliverySessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_sessions_orderId_key"
  ON "delivery_sessions"("orderId");

CREATE INDEX IF NOT EXISTS "delivery_sessions_courierId_status_idx"
  ON "delivery_sessions"("courierId", "status");

CREATE INDEX IF NOT EXISTS "delivery_sessions_status_currentStep_idx"
  ON "delivery_sessions"("status", "currentStep");

ALTER TABLE "delivery_sessions"
  ADD CONSTRAINT "delivery_sessions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_sessions"
  ADD CONSTRAINT "delivery_sessions_courierId_fkey"
  FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
