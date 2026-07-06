const prisma = require("../config/prisma");
const auditLogService = require("./auditLog.service");

const KEYS = {
  DELIVERY_FEE: "DELIVERY_FEE",
};

const DEFAULTS = {
  [KEYS.DELIVERY_FEE]: 30000,
};

async function get(key) {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return DEFAULTS[key] ?? null;
  const num = Number(row.value);
  return Number.isFinite(num) ? num : row.value;
}

async function getDeliveryFee() {
  return get(KEYS.DELIVERY_FEE);
}

async function setDeliveryFee(amount, adminContext = {}) {
  const value = Math.max(0, Math.round(Number(amount)));
  if (!Number.isFinite(value)) {
    throw new Error("Yetkazib berish narxi noto'g'ri");
  }
  const before = await getDeliveryFee();
  await prisma.systemSetting.upsert({
    where: { key: KEYS.DELIVERY_FEE },
    create: { key: KEYS.DELIVERY_FEE, value: String(value) },
    update: { value: String(value) },
  });
  await auditLogService.log({
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "DELIVERY_FEE_UPDATED",
    entityType: "SystemSetting",
    beforeData: { deliveryFee: before },
    afterData: { deliveryFee: value },
  });
  return value;
}

module.exports = {
  KEYS,
  get,
  getDeliveryFee,
  setDeliveryFee,
};
