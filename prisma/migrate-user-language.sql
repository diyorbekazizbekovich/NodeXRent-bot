SET search_path TO playstation_rental;

ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(8);
