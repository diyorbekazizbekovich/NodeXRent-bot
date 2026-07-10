-- Professional inventory items + rental contracts + order photos
SET search_path TO playstation_rental;

-- OrderStatus: ACTIVE (faol ijara — topshirish yakunlangandan keyin)
DO $$ BEGIN
  ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryItemType" AS ENUM ('CONSOLE', 'JOYSTICK', 'HDMI', 'POWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryItemStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConditionGrade" AS ENUM ('IDEAL', 'GOOD', 'MINOR_ISSUE', 'SERIOUS_ISSUE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderPhotoType" AS ENUM ('HANDOVER', 'RETURN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  "itemType" "InventoryItemType" NOT NULL,
  "consoleType" "ConsoleType",
  "inventoryNumber" VARCHAR(64) NOT NULL UNIQUE,
  "serialNumber" VARCHAR(128) NOT NULL UNIQUE,
  condition "ConditionGrade" NOT NULL DEFAULT 'GOOD',
  status "InventoryItemStatus" NOT NULL DEFAULT 'AVAILABLE',
  "purchasedAt" TIMESTAMP(3),
  note TEXT,
  "reservedOrderId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS inventory_items_itemType_status_idx ON inventory_items ("itemType", status);
CREATE INDEX IF NOT EXISTS inventory_items_consoleType_status_idx ON inventory_items ("consoleType", status);

CREATE TABLE IF NOT EXISTS inventory_item_history (
  id SERIAL PRIMARY KEY,
  "inventoryItemId" INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  action VARCHAR(64) NOT NULL,
  "fromStatus" "InventoryItemStatus",
  "toStatus" "InventoryItemStatus",
  "orderId" INTEGER,
  note TEXT,
  "actorType" VARCHAR(32),
  "actorId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS inventory_item_history_item_idx ON inventory_item_history ("inventoryItemId");

CREATE TABLE IF NOT EXISTS order_inventory_items (
  id SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "inventoryItemId" INTEGER NOT NULL REFERENCES inventory_items(id),
  role "InventoryItemType" NOT NULL,
  "returnedAt" TIMESTAMP(3),
  "returnCondition" "ConditionGrade",
  "returnNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("orderId", "inventoryItemId")
);

CREATE INDEX IF NOT EXISTS order_inventory_items_order_idx ON order_inventory_items ("orderId");

CREATE TABLE IF NOT EXISTS rental_contracts (
  id SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  "contractNumber" VARCHAR(64) NOT NULL UNIQUE,
  "pdfPath" TEXT,
  "telegramFileId" TEXT,
  payload JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_photos (
  id SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "photoType" "OrderPhotoType" NOT NULL,
  "filePath" TEXT,
  "telegramFileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS order_photos_order_type_idx ON order_photos ("orderId", "photoType");

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "consoleItemId" INTEGER,
  ADD COLUMN IF NOT EXISTS "hdmiItemId" INTEGER,
  ADD COLUMN IF NOT EXISTS "powerItemId" INTEGER,
  ADD COLUMN IF NOT EXISTS "returnCondition" "ConditionGrade",
  ADD COLUMN IF NOT EXISTS "returnNote" TEXT,
  ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_consoleItemId_fkey
    FOREIGN KEY ("consoleItemId") REFERENCES inventory_items(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_hdmiItemId_fkey
    FOREIGN KEY ("hdmiItemId") REFERENCES inventory_items(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_powerItemId_fkey
    FOREIGN KEY ("powerItemId") REFERENCES inventory_items(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed sample inventory if empty (dev)
INSERT INTO inventory_items ("itemType", "consoleType", "inventoryNumber", "serialNumber", condition, status, "purchasedAt")
SELECT v."itemType"::"InventoryItemType", v."consoleType"::"ConsoleType", v."inventoryNumber", v."serialNumber",
       'GOOD'::"ConditionGrade", 'AVAILABLE'::"InventoryItemStatus", CURRENT_DATE
FROM (VALUES
  ('CONSOLE', 'PS5', 'NX-PS5-001', 'CFI-2018A-45873291'),
  ('CONSOLE', 'PS5', 'NX-PS5-002', 'CFI-2018A-45873292'),
  ('CONSOLE', 'PS4', 'NX-PS4-001', 'CUH-2216B-10000001'),
  ('JOYSTICK', NULL, 'NX-JS-001', 'JS-SN-0001'),
  ('JOYSTICK', NULL, 'NX-JS-002', 'JS-SN-0002'),
  ('JOYSTICK', NULL, 'NX-JS-003', 'JS-SN-0003'),
  ('JOYSTICK', NULL, 'NX-JS-004', 'JS-SN-0004'),
  ('JOYSTICK', NULL, 'NX-JS-005', 'JS-SN-0005'),
  ('JOYSTICK', NULL, 'NX-JS-006', 'JS-SN-0006'),
  ('JOYSTICK', NULL, 'NX-JS-007', 'JS-SN-0007'),
  ('JOYSTICK', NULL, 'NX-JS-008', 'JS-SN-0008'),
  ('HDMI', NULL, 'NX-HDMI-001', 'HDMI-SN-0001'),
  ('HDMI', NULL, 'NX-HDMI-002', 'HDMI-SN-0002'),
  ('POWER', NULL, 'NX-PWR-001', 'PWR-SN-0001'),
  ('POWER', NULL, 'NX-PWR-002', 'PWR-SN-0002')
) AS v("itemType", "consoleType", "inventoryNumber", "serialNumber")
WHERE NOT EXISTS (SELECT 1 FROM inventory_items LIMIT 1);
