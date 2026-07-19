-- Occupying unique index: include ADMIN_CONFIRMED (reservation at approve).
-- Terminal / returned statuses may keep inventoryUnitId for history without blocking reuse.

DROP INDEX IF EXISTS "orders_unique_occupying_inventory_unit";

CREATE UNIQUE INDEX "orders_unique_occupying_inventory_unit"
ON "orders" ("inventoryUnitId")
WHERE "inventoryUnitId" IS NOT NULL
  AND status IN (
    'ADMIN_CONFIRMED',
    'ACCEPTED',
    'COURIER_ASSIGNED',
    'ON_THE_WAY',
    'ARRIVED',
    'DELIVERED',
    'ACTIVE',
    'RETURN_REQUESTED',
    'RETURN_ASSIGNED',
    'PICKED_UP',
    'EXPIRED'
  );
