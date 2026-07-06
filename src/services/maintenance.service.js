const prisma = require("../config/prisma");
const auditLogService = require("./auditLog.service");

const KEYS = {
  MAINTENANCE_MODE: "MAINTENANCE_MODE",
};

async function isEnabled() {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEYS.MAINTENANCE_MODE } });
  return row?.value === "true";
}

async function setEnabled(enabled, adminContext = {}) {
  const before = await isEnabled();
  await prisma.systemSetting.upsert({
    where: { key: KEYS.MAINTENANCE_MODE },
    create: { key: KEYS.MAINTENANCE_MODE, value: String(Boolean(enabled)) },
    update: { value: String(Boolean(enabled)) },
  });
  await auditLogService.log({
    module: "SYSTEM",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "MAINTENANCE_MODE_TOGGLED",
    entityType: "SystemSetting",
    beforeData: { enabled: before },
    afterData: { enabled: Boolean(enabled) },
  });
  return Boolean(enabled);
}

async function assertCanCreateOrder(isAdmin = false) {
  const on = await isEnabled();
  if (on && !isAdmin) {
    const err = new Error("🚧 Texnik ishlar olib borilmoqda. Yangi buyurtma vaqtincha qabul qilinmaydi.");
    err.code = "MAINTENANCE_MODE";
    throw err;
  }
}

module.exports = { isEnabled, setEnabled, assertCanCreateOrder };
