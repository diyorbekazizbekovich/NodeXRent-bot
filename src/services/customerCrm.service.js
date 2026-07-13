const customerRepository = require("../repositories/customer.repository");
const auditLogService = require("./auditLog.service");
const { label: ratingLabel } = require("../constants/customerRating");
const { label: statusLabel } = require("../constants/orderStatus");
const { formatDatetime, formatDate } = require("../utils/dateHelper");
const { escapeHtml } = require("../utils/telegramFormat");

function formatMoney(n) {
  return `${Math.round(Number(n)).toLocaleString("uz-UZ")} so'm`;
}

async function getCustomerProfile(userId) {
  const user = await customerRepository.findById(userId);
  if (!user) return null;
  const stats = await customerRepository.getOrderStats(userId);
  return { user, stats };
}

function formatProfile({ user, stats }) {
  const lines = [
    "👤 <b>Mijoz profili</b>",
    "",
    `<b>Ism:</b> ${escapeHtml(user.fullName || "—")}`,
    `<b>Telefon:</b> ${escapeHtml(user.phone || "—")}`,
    `<b>Telegram ID:</b> <code>${escapeHtml(user.telegramId)}</code>`,
    `<b>Username:</b> ${user.username ? "@" + escapeHtml(user.username) : "—"}`,
    `<b>Ro'yxatdan o'tgan:</b> ${escapeHtml(formatDate(user.createdAt))}`,
    `<b>Oxirgi faollik:</b> ${user.lastActivityAt ? escapeHtml(formatDatetime(user.lastActivityAt)) : "—"}`,
    "",
    `<b>Jami buyurtmalar:</b> ${stats.totalOrders}`,
    `<b>Jami sarflangan:</b> ${escapeHtml(formatMoney(stats.totalSpent))}`,
    `<b>Oxirgi buyurtma:</b> ${stats.lastOrderAt ? escapeHtml(formatDatetime(stats.lastOrderAt)) : "—"}`,
    `<b>Faol ijaralar:</b> ${stats.activeRentals}`,
    `<b>Bekor qilingan:</b> ${stats.cancelledOrders}`,
    `<b>Reyting:</b> ${escapeHtml(ratingLabel(user.customerRating))}`,
    "",
    user.adminNotes
      ? `<b>Admin izohi:</b>\n${escapeHtml(user.adminNotes)}`
      : "<b>Admin izohi:</b> —",
  ];
  return lines.join("\n");
}

function formatOrderHistory(user) {
  const lines = ["📜 <b>Buyurtmalar tarixi</b>", ""];
  if (!user.orders.length) return lines.join("\n") + "Buyurtmalar yo'q.";
  for (const o of user.orders) {
    lines.push(
      `#${o.id} | ${escapeHtml(o.consoleType)} | ${escapeHtml(statusLabel(o.status))}`,
      `  ${escapeHtml(formatDatetime(o.createdAt))} | ${escapeHtml(formatMoney(Number(o.totalPrice) + Number(o.deliveryFee)))}`,
      o.inventoryUnit ? `  Qurilma: ${escapeHtml(o.inventoryUnit.unitCode)}` : "",
      ""
    );
  }
  return lines.join("\n");
}

async function listCustomers({ query, page = 0, pageSize = 10 } = {}) {
  return customerRepository.searchUsers({ query, skip: page * pageSize, take: pageSize });
}

async function setRating(userId, customerRating, adminContext = {}) {
  const before = await customerRepository.findById(userId);
  const user = await customerRepository.updateRating(userId, customerRating);
  await auditLogService.log({
    module: "CRM",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "CUSTOMER_RATING_UPDATED",
    entityType: "User",
    entityId: userId,
    beforeData: { customerRating: before?.customerRating },
    afterData: { customerRating },
  });
  return user;
}

async function setNotes(userId, adminNotes, adminContext = {}) {
  const user = await customerRepository.updateNotes(userId, adminNotes);
  await auditLogService.log({
    module: "CRM",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "CUSTOMER_NOTES_UPDATED",
    entityType: "User",
    entityId: userId,
    afterData: { adminNotes },
  });
  return user;
}

module.exports = {
  getCustomerProfile,
  formatProfile,
  formatOrderHistory,
  listCustomers,
  setRating,
  setNotes,
};
