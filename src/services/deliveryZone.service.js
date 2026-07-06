const prisma = require("../config/prisma");
const auditLogService = require("./auditLog.service");

const DEFAULT_ZONE = "CITY";

async function listActive() {
  return prisma.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

async function getFeeByCode(code = DEFAULT_ZONE) {
  const zone = await prisma.deliveryZone.findFirst({
    where: { code, isActive: true },
  });
  if (zone) return Number(zone.fee);
  const settings = require("./settings.service");
  return settings.getDeliveryFee();
}

async function upsertZone({ code, name, fee }, adminContext = {}) {
  const zone = await prisma.deliveryZone.upsert({
    where: { code },
    create: { code, name, fee, isActive: true },
    update: { name, fee },
  });
  await auditLogService.log({
    module: "DELIVERY",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "DELIVERY_ZONE_UPDATED",
    entityType: "DeliveryZone",
    entityId: zone.id,
    afterData: { code, name, fee: Number(fee) },
  });
  return zone;
}

module.exports = { listActive, getFeeByCode, upsertZone, DEFAULT_ZONE };
