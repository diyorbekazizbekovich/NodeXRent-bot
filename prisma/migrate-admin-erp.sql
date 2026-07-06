-- Admin ERP: inventory units, settings, audit logs, delivery fee
SET search_path TO playstation_rental;

CREATE TABLE IF NOT EXISTS inventory_units (
  id SERIAL PRIMARY KEY,
  "unitCode" VARCHAR(255) NOT NULL UNIQUE,
  "consoleType" "ConsoleType" NOT NULL,
  status "PlaystationStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS inventory_units_consoleType_status_idx
  ON inventory_units ("consoleType", status);

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  "adminId" INTEGER,
  "adminTelegramId" BIGINT,
  action VARCHAR(255) NOT NULL,
  "entityType" VARCHAR(255),
  "entityId" INTEGER,
  "beforeData" JSONB,
  "afterData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_createdAt_idx
  ON admin_audit_logs ("createdAt");

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "inventoryUnitId" INTEGER REFERENCES inventory_units(id);

INSERT INTO system_settings (key, value, "updatedAt")
VALUES ('DELIVERY_FEE', '30000', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Seed inventory units from existing playstation counts per type (if empty)
DO $$
DECLARE
  ct "ConsoleType";
  cnt INT;
  i INT;
  code TEXT;
BEGIN
  IF (SELECT COUNT(*) FROM inventory_units) = 0 THEN
    FOREACH ct IN ARRAY ARRAY['PS3'::"ConsoleType", 'PS4'::"ConsoleType", 'PS5'::"ConsoleType"] LOOP
      SELECT COUNT(*) INTO cnt FROM playstations WHERE type = ct;
      IF cnt = 0 THEN
        cnt := CASE ct WHEN 'PS3' THEN 10 WHEN 'PS4' THEN 7 ELSE 5 END;
      END IF;
      FOR i IN 1..cnt LOOP
        code := ct || '-' || LPAD(i::TEXT, 3, '0');
        INSERT INTO inventory_units ("unitCode", "consoleType", status)
        VALUES (code, ct, 'AVAILABLE')
        ON CONFLICT ("unitCode") DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;
END $$;
