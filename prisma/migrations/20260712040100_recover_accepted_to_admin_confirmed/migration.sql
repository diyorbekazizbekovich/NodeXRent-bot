-- Recover stuck ACCEPTED orders (admin confirmed, no courier) into ADMIN_CONFIRMED pool
UPDATE "orders"
SET "status" = 'ADMIN_CONFIRMED'::"OrderStatus"
WHERE "status" = 'ACCEPTED'::"OrderStatus"
  AND "courierId" IS NULL;
