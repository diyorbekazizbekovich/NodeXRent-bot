-- ERP v2: CRM, inventory detail, payments, extensions, delivery zones, backup
SET search_path TO playstation_rental;

-- Enums
DO $$ BEGIN
  CREATE TYPE "CustomerRating" AS ENUM ('TRUSTED', 'NORMAL', 'RISKY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED', 'LOYALTY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CLICK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExtensionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "PlaystationStatus" ADD VALUE IF NOT EXISTS 'DEFECTIVE';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';

-- Users CRM
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);
ALTER TABLE users ADD COLUMN IF NOT EXISTS "customerRating" "CustomerRating" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
CREATE INDEX IF NOT EXISTS users_lastActivityAt_idx ON users ("lastActivityAt");

-- Couriers
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) NOT NULL DEFAULT 5;

-- Inventory units extended
ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS "purchasedAt" TIMESTAMP(3);
ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS "purchasePrice" DECIMAL(10,2);
ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS "lastServiceAt" TIMESTAMP(3);
ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS "adminNote" TEXT;

CREATE TABLE IF NOT EXISTS inventory_unit_history (
  id SERIAL PRIMARY KEY,
  "inventoryUnitId" INTEGER NOT NULL REFERENCES inventory_units(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  "fromStatus" "PlaystationStatus",
  "toStatus" "PlaystationStatus",
  "orderId" INTEGER,
  note TEXT,
  "actorType" VARCHAR(64),
  "actorId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS inventory_unit_history_unit_idx ON inventory_unit_history ("inventoryUnitId", "createdAt");

-- Delivery zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  fee DECIMAL(10,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO delivery_zones (code, name, fee, "isActive", "sortOrder")
VALUES ('CITY', 'Shahar ichida', 30000, true, 1)
ON CONFLICT (code) DO NOTHING;

-- Promocodes extended
ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENT';
ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2);
ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS "loyaltyMinOrders" INTEGER;
ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE promocodes ALTER COLUMN "discountPercent" SET DEFAULT 0;

-- Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "deliveryZoneCode" VARCHAR(64);

-- Order payments (migrate from payments if exists)
CREATE TABLE IF NOT EXISTS order_payments (
  id SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method "PaymentMethod" NOT NULL DEFAULT 'CASH',
  status "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "paidAt" TIMESTAMP(3),
  note TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS order_payments_orderId_idx ON order_payments ("orderId");
CREATE INDEX IF NOT EXISTS order_payments_status_idx ON order_payments (status);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'playstation_rental' AND table_name = 'payments') THEN
    INSERT INTO order_payments ("orderId", amount, method, status, "paidAt", "createdAt")
    SELECT p."orderId", p.amount,
      CASE WHEN LOWER(p.method) = 'click' THEN 'CLICK'::"PaymentMethod" ELSE 'CASH'::"PaymentMethod" END,
      CASE p.status
        WHEN 'PAID' THEN 'PAID'::"PaymentStatus"
        WHEN 'FAILED' THEN 'FAILED'::"PaymentStatus"
        WHEN 'REFUNDED' THEN 'REFUNDED'::"PaymentStatus"
        ELSE 'UNPAID'::"PaymentStatus"
      END,
      p."paidAt", p."createdAt"
    FROM payments p
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Rental extensions
CREATE TABLE IF NOT EXISTS rental_extensions (
  id SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL REFERENCES orders(id),
  "extraHours" INTEGER NOT NULL,
  "extraPrice" DECIMAL(10,2) NOT NULL,
  status "ExtensionStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByAdminId" INTEGER,
  "previousEnd" TIMESTAMP(3) NOT NULL,
  "newEnd" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS rental_extensions_order_idx ON rental_extensions ("orderId", status);

-- Database backups
CREATE TABLE IF NOT EXISTS database_backups (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" BIGINT,
  "createdByAdminId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS database_backups_createdAt_idx ON database_backups ("createdAt");

-- Audit log module
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(128);
CREATE INDEX IF NOT EXISTS admin_audit_logs_module_idx ON admin_audit_logs (module);

-- Maintenance mode setting
INSERT INTO system_settings (key, value, "updatedAt")
VALUES ('MAINTENANCE_MODE', 'false', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- 7-day rental prices (168 hours)
DO $$
DECLARE
  cat RECORD;
  base_price DECIMAL;
BEGIN
  FOR cat IN SELECT id, code FROM console_catalog LOOP
    SELECT price * 2.2 INTO base_price FROM rental_prices
    WHERE "consoleCatalogId" = cat.id AND hours = 72 LIMIT 1;
    IF base_price IS NOT NULL THEN
      INSERT INTO rental_prices ("consoleCatalogId", hours, price, currency, "isActive")
      VALUES (cat.id, 168, ROUND(base_price), 'UZS', true)
      ON CONFLICT ("consoleCatalogId", hours) DO NOTHING;
    END IF;
  END LOOP;
END $$;
