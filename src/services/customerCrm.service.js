const customerRepository = require("../repositories/customer.repository");
const auditLogService = require("./auditLog.service");
const { label: ratingLabel } = require("../constants/customerRating");
const { label: statusLabel } = require("../constants/orderStatus");
const { formatDatetime, formatDate } = require("../utils/dateHelper");

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
    "👤 *Mijoz profili*",
    "",
    `*Ism:* ${user.fullName || "—"}`,
    `*Telefon:* ${user.phone || "—"}`,
    `*Telegram ID:* \`${user.telegramId}\``,
    `*Username:* ${user.username ? "@" + user.username : "—"}`,
    `*Ro'yxatdan o'tgan:* ${formatDate(user.createdAt)}`,
    `*Oxirgi faollik:* ${user.lastActivityAt ? formatDatetime(user.lastActivityAt) : "—"}`,
    "",
    `*Jami buyurtmalar:* ${stats.totalOrders}`,
    `*Jami sarflangan:* ${formatMoney(stats.totalSpent)}`,
    `*Oxirgi buyurtma:* ${stats.lastOrderAt ? formatDatetime(stats.lastOrderAt) : "—"}`,
    `*Faol ijaralar:* ${stats.activeRentals}`,
    `*Bekor qilingan:* ${stats.cancelledOrders}`,
    `*Reyting:* ${ratingLabel(user.customerRating)}`,
    "",
    user.adminNotes ? `*Admin izohi:*\n${user.adminNotes}` : "*Admin izohi:* —",
  ];
  return lines.join("\n");
}

function formatOrderHistory(user) {
  const lines = ["📜 *Buyurtmalar tarixi*", ""];
  if (!user.orders.length) return lines.join("\n") + "Buyurtmalar yo'q.";
  for (const o of user.orders) {
    lines.push(
      `#${o.id} | ${o.consoleType} | ${statusLabel(o.status)}`,
      `  ${formatDatetime(o.createdAt)} | ${formatMoney(Number(o.totalPrice) + Number(o.deliveryFee))}`,
      o.inventoryUnit ? `  Qurilma: ${o.inventoryUnit.unitCode}` : "",
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
