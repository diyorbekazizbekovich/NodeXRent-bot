-- Delivery handover: payment + collateral fields on orders
SET search_path TO playstation_rental;

-- PaymentMethod: CARD (Naqd/Karta)
DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CARD';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CollateralType enum
DO $$ BEGIN
  CREATE TYPE "CollateralType" AS ENUM ('ID_CARD', 'PASSPORT', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "paymentReceived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod",
  ADD COLUMN IF NOT EXISTS "paymentReceivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalPaidAmount" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "collateralType" "CollateralType",
  ADD COLUMN IF NOT EXISTS "collateralTaken" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "collateralReturned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deliveredByCourierId" INTEGER;

DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_deliveredByCourierId_fkey
    FOREIGN KEY ("deliveredByCourierId") REFERENCES couriers(id)
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS orders_paymentReceived_idx ON orders ("paymentReceived");
