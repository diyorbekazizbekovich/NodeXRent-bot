-- AlterEnum: add UNIT_SELECT for serial-based console pick at handover
ALTER TYPE "DeliverySessionStep" ADD VALUE IF NOT EXISTS 'UNIT_SELECT';
