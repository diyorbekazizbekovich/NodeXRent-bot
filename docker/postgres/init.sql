-- Ensure Prisma schema namespace exists (DATABASE_URL ?schema=playstation_rental)
CREATE SCHEMA IF NOT EXISTS playstation_rental;
GRANT ALL ON SCHEMA playstation_rental TO CURRENT_USER;
