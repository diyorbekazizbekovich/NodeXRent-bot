const prisma = require("../config/prisma");
const { ACTIVE_RENTAL_STATUSES } = require("../constants/orderStatus");
const { startOfDay, endOfDay } = require("../utils/dateHelper");
const reminderService = require("./reminder.service");
const { confirmWindowHours } = require("./orderConfirmation.service");
const env = require("../config/env");

async function getAdminAlerts() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const confirmDeadline = new Date(now.getTime() + confirmWindowHours() * 3600 * 1000);
  const priorityDeadline = new Date(
    now.getTime() + (Number(env.ORDER_PRIORITY_REMINDER_HOURS) || 2) * 3600 * 1000
  );

  const [
    newOrders,
    dueReturns,
    overdueRentals,
    pendingExtensions,
    upcomingOrders,
    readyForConfirmation,
    highPriority,
  ] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING", courierId: null } }),
    prisma.order.count({
      where: {
        status: { in: ["DELIVERED", "ACTIVE", "RETURN_REQUESTED"] },
        endDatetime: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.order.count({
      where: {
        status: { in: ACTIVE_RENTAL_STATUSES },
        endDatetime: { lt: now },
      },
    }),
    prisma.rentalExtension.count({ where: { status: "PENDING" } }),
    prisma.order.count({
      where: {
        status: { in: ["PENDING", "COURIER_ASSIGNED", "ACCEPTED", "ON_THE_WAY"] },
        startDatetime: { gt: now },
      },
    }),
    prisma.order.count({
      where: {
        status: "PENDING",
        startDatetime: { lte: confirmDeadline },
      },
    }),
    prisma.order.count({
      where: {
        status: "PENDING",
        OR: [{ isHighPriority: true }, { startDatetime: { lte: priorityDeadline } }],
      },
    }),
  ]);

  return {
    newOrders,
    dueReturns,
    overdueRentals,
    pendingExtensions,
    upcomingOrders,
    readyForConfirmation,
    highPriority,
  };
}

function formatAlerts(alerts) {
  const lines = [
    "🔔 <b>Sizda:</b>",
    `• ${alerts.newOrders} ta yangi buyurtma`,
    `• ${alerts.upcomingOrders ?? 0} ta upcoming (kelgusi)`,
    `• ${alerts.readyForConfirmation ?? 0} ta Ready for Confirmation (≤${confirmWindowHours()} soat)`,
    `• ${alerts.highPriority ?? 0} ta 🚨 High Priority (≤2 soat)`,
    `• ${alerts.dueReturns} ta qaytarilishi kerak bo'lgan PlayStation`,
    `• ${alerts.overdueRentals} ta kechikayotgan ijara`,
  ];
  if (alerts.pendingExtensions > 0) {
    lines.push(`• ${alerts.pendingExtensions} ta uzaytirish so'rovi`);
  }
  return lines.join("\n");
}

async function formatUpcomingBlocks() {
  const [upcoming, ready, priority] = await Promise.all([
    reminderService.listUpcomingOrders({ take: 8 }),
    reminderService.listReadyForConfirmation({ take: 8 }),
    reminderService.listHighPriorityOrders({ take: 8 }),
  ]);

  const line = (o) => {
    const start = new Date(o.startDatetime).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
    const flag = o.isHighPriority ? "🚨 " : "";
    return `• ${flag}#${o.id} ${o.consoleType} — ${start} — ${o.status}`;
  };

  const blocks = [
    "📅 <b>Upcoming Orders</b>",
    upcoming.length ? upcoming.map(line).join("\n") : "• Yo'q",
    "",
    `✅ <b>Ready for Confirmation</b> (≤${confirmWindowHours()} soat)`,
    ready.length ? ready.map(line).join("\n") : "• Yo'q",
    "",
    "🚨 <b>High Priority</b> (≤2 soat / tasdiqlanmagan)",
    priority.length ? priority.map(line).join("\n") : "• Yo'q",
  ];
  return blocks.join("\n");
}

async function formatDashboardAlertsSection() {
  const [alerts, upcomingBlock] = await Promise.all([
    getAdminAlerts(),
    formatUpcomingBlocks(),
  ]);
  return `${formatAlerts(alerts)}\n\n${upcomingBlock}`;
}

module.exports = {
  getAdminAlerts,
  formatAlerts,
  formatUpcomingBlocks,
  formatDashboardAlertsSection,
};
