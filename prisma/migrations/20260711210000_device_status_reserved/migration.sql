-- Device status lifecycle: RESERVED + one occupying PS per order
ALTER TYPE "PlaystationStatus" ADD VALUE IF NOT EXISTS 'RESERVED';

-- DB uses Prisma camelCase column names (quoted)
CREATE UNIQUE INDEX IF NOT EXISTS orders_unique_occupying_playstation
ON "orders" ("playstationId")
WHERE "playstationId" IS NOT NULL
  AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'RETURNED');
