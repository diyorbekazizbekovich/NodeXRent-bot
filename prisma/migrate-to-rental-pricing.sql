-- PlayStation rental pricing system migration
SET search_path TO playstation_rental;

CREATE TABLE IF NOT EXISTS console_catalog (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rental_prices (
  id SERIAL PRIMARY KEY,
  "consoleCatalogId" INTEGER NOT NULL REFERENCES console_catalog(id) ON DELETE CASCADE,
  hours INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UZS',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("consoleCatalogId", hours)
);

INSERT INTO console_catalog (code, "displayName", "sortOrder")
VALUES
  ('PS3', 'PlayStation 3', 1),
  ('PS4', 'PlayStation 4', 2),
  ('PS5', 'PlayStation 5', 3)
ON CONFLICT (code) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true;

INSERT INTO rental_prices ("consoleCatalogId", hours, price, currency)
SELECT c.id, v.hours, v.price, 'UZS'
FROM console_catalog c
JOIN (VALUES
  ('PS3', 24, 40000),
  ('PS3', 48, 70000),
  ('PS3', 72, 95000),
  ('PS4', 24, 80000),
  ('PS4', 48, 140000),
  ('PS4', 72, 190000),
  ('PS5', 24, 120000),
  ('PS5', 48, 220000),
  ('PS5', 72, 300000)
) AS v(code, hours, price) ON c.code = v.code
ON CONFLICT ("consoleCatalogId", hours) DO UPDATE SET
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  "isActive" = true;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "rentalPriceId" INTEGER;

UPDATE orders o
SET "rentalPriceId" = rp.id
FROM tariffs t, rental_prices rp, console_catalog cc
WHERE o."tariffId" = t.id
  AND cc.code = o."consoleType"::text
  AND rp."consoleCatalogId" = cc.id
  AND rp.hours = t.hours
  AND o."rentalPriceId" IS NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_tariffId_fkey;
ALTER TABLE orders DROP COLUMN IF EXISTS "tariffId";
ALTER TABLE orders ALTER COLUMN "rentalPriceId" SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_rentalPriceId_fkey
  FOREIGN KEY ("rentalPriceId") REFERENCES rental_prices(id);

DROP TABLE IF EXISTS tariffs;
