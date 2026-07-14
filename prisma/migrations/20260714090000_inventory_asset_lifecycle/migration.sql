-- Inventory asset lifecycle: new statuses + per-unit identity fields
-- Non-destructive: existing rows keep status; new columns nullable.

ALTER TYPE "PlaystationStatus" ADD VALUE IF NOT EXISTS 'INSPECTION';
ALTER TYPE "PlaystationStatus" ADD VALUE IF NOT EXISTS 'DISABLED';
ALTER TYPE "PlaystationStatus" ADD VALUE IF NOT EXISTS 'LOST';

ALTER TABLE "inventory_units" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "inventory_units" ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_units_serialNumber_key"
  ON "inventory_units"("serialNumber");

CREATE INDEX IF NOT EXISTS "inventory_units_status_idx"
  ON "inventory_units"("status");

-- One occupying InventoryUnit per active order (race-safe asset assignment)
CREATE UNIQUE INDEX IF NOT EXISTS "orders_unique_occupying_inventory_unit"
ON "orders" ("inventoryUnitId")
WHERE "inventoryUnitId" IS NOT NULL
  AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'RETURNED');
