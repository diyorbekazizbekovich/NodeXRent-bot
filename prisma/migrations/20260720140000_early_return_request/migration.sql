-- Early return request (independent of Order status until admin approves)

DO $$ BEGIN
  CREATE TYPE "ReturnRequestStatus" AS ENUM ('PENDING_ADMIN', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EarlyReturnReason" AS ENUM ('WORK_DONE', 'TRAVEL', 'AWAY_FROM_HOME', 'NO_LONGER_NEEDED', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EARLY_RETURN_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EARLY_RETURN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EARLY_RETURN_REJECTED';

CREATE TABLE IF NOT EXISTS "return_requests" (
  "id" SERIAL NOT NULL,
  "orderId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "reason" "EarlyReturnReason" NOT NULL,
  "customReason" TEXT,
  "pickupAddress" TEXT NOT NULL,
  "pickupLatitude" DOUBLE PRECISION,
  "pickupLongitude" DOUBLE PRECISION,
  "requestedPickupTime" TIMESTAMP(3) NOT NULL,
  "remainingRentalTime" TEXT,
  "status" "ReturnRequestStatus" NOT NULL DEFAULT 'PENDING_ADMIN',
  "adminNote" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedByAdminId" INTEGER,
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "return_requests_orderId_status_idx" ON "return_requests"("orderId", "status");
CREATE INDEX IF NOT EXISTS "return_requests_customerId_status_idx" ON "return_requests"("customerId", "status");
CREATE INDEX IF NOT EXISTS "return_requests_status_createdAt_idx" ON "return_requests"("status", "createdAt");

ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_approvedByAdminId_fkey"
  FOREIGN KEY ("approvedByAdminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
