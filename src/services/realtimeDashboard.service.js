const prisma = require("../config/prisma");
const dashboardSubscriptionStore = require("../stores/dashboardSubscriptionStore");
const auditLogService = require("./auditLog.service");

const KEY_PREFIX = "REALTIME_DASHBOARD:";

function settingKey(telegramId) {
  return `${KEY_PREFIX}${telegramId}`;
}

async function isEnabled(telegramId) {
  const row = await prisma.systemSetting.findUnique({ where: { key: settingKey(telegramId) } });
  if (!row) {
    const def = await prisma.systemSetting.findUnique({ where: { key: "REALTIME_DASHBOARD_DEFAULT" } });
    return def?.value !== "false";
  }
  return row.value === "true";
}

async function setEnabled(telegramId, enabled, adminContext = {}) {
  const before = await isEnabled(telegramId);
  await prisma.systemSetting.upsert({
    where: { key: settingKey(telegramId) },
    create: { key: settingKey(telegramId), value: String(Boolean(enabled)) },
    update: { value: String(Boolean(enabled)) },
  });

  if (!enabled) {
    dashboardSubscriptionStore.unsubscribe(String(telegramId));
  }

  await auditLogService.log({
    module: "SETTINGS",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "REALTIME_DASHBOARD_TOGGLED",
    beforeData: { enabled: before },
    afterData: { enabled: Boolean(enabled) },
  });

  return Boolean(enabled);
}

async function toggle(telegramId, adminContext = {}) {
  const next = !(await isEnabled(telegramId));
  await setEnabled(telegramId, next, adminContext);
  return next;
}

function subscribe(chatId, messageId) {
  dashboardSubscriptionStore.subscribe(String(chatId), messageId);
}

function unsubscribe(chatId) {
  dashboardSubscriptionStore.unsubscribe(String(chatId));
}

function isSubscribed(chatId) {
  return dashboardSubscriptionStore.isSubscribed(String(chatId));
}

module.exports = {
  isEnabled,
  setEnabled,
  toggle,
  subscribe,
  unsubscribe,
  isSubscribed,
};
