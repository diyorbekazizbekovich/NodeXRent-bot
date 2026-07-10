const { formatDatetime } = require("../utils/dateHelper");
const pricingService = require("./pricing.service");
const { notify, sendToTelegram } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const { label } = require("../constants/orderStatus");
const adminOrderKeyboards = require("../bot/keyboards/admin.order.keyboards");
const courierKeyboards = require("../bot/keyboards/courier.keyboards");

function formatUsername(username) {
  return username ? `@${username.replace(/^@/, "")}` : "—";
}

function formatLocation(order) {
  if (order.latitude != null && order.longitude != null) {
    return `${Number(order.latitude).toFixed(5)}, ${Number(order.longitude).toFixed(5)}`;
  }
  return "—";
}

function buildOrderDetailsText(order) {
  const user = order.user;
  const rental = order.rentalPrice;
  const duration = rental?.hours ?? "—";
  const rentalPrice = rental ? Number(rental.price) : Number(order.totalPrice);
  const deliveryFee = Number(order.deliveryFee || 0);
  const deposit = Number(order.depositAmount || 0);
  const grandTotal = Number(order.totalPrice) + deliveryFee;
  const unitCode = order.inventoryUnit?.unitCode;

  return (
    `🆕 <b>Buyurtma #${order.id}</b>\n\n` +
    `👤 Mijoz: ${user?.fullName || "—"}\n` +
    `🔗 Username: ${formatUsername(user?.username)}\n` +
    `🆔 Telegram ID: ${user?.telegramId || "—"}\n` +
    `📱 Telefon: ${user?.phone || "—"}\n` +
    `📍 Manzil: ${order.address}\n` +
    `🗺 Lokatsiya: ${formatLocation(order)}\n` +
    `🎮 Konsol: ${order.consoleType}\n` +
    (unitCode ? `🏷 Qurilma: <b>${unitCode}</b>\n` : "") +
    `⏱ Muddat: ${duration} soat\n` +
    `💵 Ijara narxi: ${pricingService.formatMoney(rentalPrice, rental?.currency || "UZS")}\n` +
    `🚚 Yetkazib berish: ${pricingService.formatMoney(deliveryFee, rental?.currency || "UZS")}\n` +
    (deposit > 0 ? `🔒 Depozit: ${pricingService.formatMoney(deposit, rental?.currency || "UZS")}\n` : "") +
    `💰 Jami: ${pricingService.formatMoney(grandTotal, rental?.currency || "UZS")}\n` +
    `🕒 Boshlanish: ${formatDatetime(order.startDatetime)}\n` +
    `📅 Yaratilgan: ${formatDatetime(order.createdAt)}\n` +
    `📌 Status: <b>${label(order.status)}</b>`
  );
}

async function notifyAdminsNewOrder(order) {
  const text = buildOrderDetailsText(order);
  const options = adminOrderKeyboards.newOrderKeyboard(order.id);
  const admins = await getAdminRecipients();

  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "ORDER_CREATED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text,
      options,
    });
  }
}

async function notifyCouriersNewOrder(order) {
  const text = buildOrderDetailsText(order);
  const couriers = await require("../repositories/courier.repository").listActive();

  for (const courier of couriers) {
    await notify({
      orderId: order.id,
      type: "ORDER_CREATED",
      recipientType: "courier",
      recipientTelegramId: courier.telegramId.toString(),
      recipientId: courier.id,
      text,
      options: courierKeyboards.newOrderKeyboard(order.id, order.latitude, order.longitude),
    });
  }
}

async function notifyCustomerOrderAccepted(order) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(order.user?.language);
  const courier = order.courier;
  const courierName = courier?.fullName || "—";
  const courierPhone = courier?.phone || "—";

  await notify({
    orderId: order.id,
    type: "ORDER_ACCEPTED",
    recipientType: "user",
    recipientTelegramId: order.user.telegramId.toString(),
    recipientId: order.userId,
    text: t("notify.accepted", L, {
      name: courierName,
      phone: courierPhone,
      id: order.id,
    }),
    options: { parse_mode: "HTML" },
  });
}

async function notifyAdminCourierAccepted(order) {
  const courier = order.courier;
  const text =
    `✅ <b>Buyurtma #${order.id} kuryer tomonidan qabul qilindi</b>\n\n` +
    `🚚 Kuryer: ${courier?.fullName || "—"}\n` +
    `📱 Telefon: ${courier?.phone || "—"}\n` +
    `🕒 Qabul vaqti: ${formatDatetime(order.acceptedAt || new Date())}`;

  const admins = await getAdminRecipients();

  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "COURIER_ASSIGNED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text,
    });
  }
}

async function notifyStatusChange(order, statusLabel, { customerText, adminText } = {}) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(order.user?.language);
  const defaultCustomer = t("notify.statusDefault", L, { id: order.id, status: statusLabel });
  const defaultAdmin = `📦 Buyurtma #${order.id} — ${statusLabel}`;

  await notify({
    orderId: order.id,
    type: "ORDER_CREATED",
    recipientType: "user",
    recipientTelegramId: order.user.telegramId.toString(),
    recipientId: order.userId,
    text: customerText || defaultCustomer,
  });

  const admins = await getAdminRecipients();

  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "ORDER_CREATED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text: adminText || defaultAdmin,
    });
  }
}

async function notifySingleCourierAssignment(order, courier) {
  const text =
    `📌 <b>Sizga buyurtma biriktirildi</b>\n\n` +
    buildOrderDetailsText(order) +
    `\n\nAdmin tomonidan tayinlandi.`;

  await notify({
    orderId: order.id,
    type: "ADMIN_ORDER_ASSIGNED",
    recipientType: "courier",
    recipientTelegramId: courier.telegramId.toString(),
    recipientId: courier.id,
    text,
    options: courierKeyboards.assignedOrderKeyboard(order.id),
  });
}

async function notifyPlaystationReturned(order) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(order.user?.language);
  const unitCode = order.inventoryUnit?.unitCode || "—";
  const customerText = t("notify.returned", L, { id: order.id, unit: unitCode });

  const adminText =
    `↩️ <b>PlayStation qaytarildi</b>\n\n` +
    `Buyurtma: #${order.id}\n` +
    `Qurilma: ${unitCode}\n` +
    `Mijoz: ${order.user?.fullName || "—"}\n` +
    `Kuryer: ${order.courier?.fullName || "—"}`;

  await notify({
    orderId: order.id,
    type: "ORDER_RETURNED",
    recipientType: "user",
    recipientTelegramId: order.user.telegramId.toString(),
    recipientId: order.userId,
    text: customerText,
  });

  const admins = await getAdminRecipients();
  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "ORDER_RETURNED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text: adminText,
    });
  }
}

async function sendLocation(chatId, latitude, longitude) {
  await sendToTelegram(chatId, `📍 <a href="https://maps.google.com/?q=${latitude},${longitude}">Xaritada ochish</a>`, {
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
}

async function notifyOrderRejected(order, { by, courierName } = {}) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(order.user?.language);
  const customerText =
    by === "courier"
      ? t("notify.rejectedCourier", L, { id: order.id })
      : t("notify.rejectedAdmin", L, { id: order.id });

  await notify({
    orderId: order.id,
    type: "ORDER_REJECTED",
    recipientType: "user",
    recipientTelegramId: order.user.telegramId.toString(),
    recipientId: order.userId,
    text: customerText,
  });

  if (by === "courier") {
    const admins = await getAdminRecipients();
    const adminText =
      `❌ <b>Buyurtma #${order.id} rad etildi</b>\n\n` +
      `🚚 Kuryer: ${courierName || "—"}\n` +
      `👤 Mijoz: ${order.user?.fullName || "—"}\n` +
      `📌 Status: REJECTED`;

    for (const admin of admins) {
      await notify({
        orderId: order.id,
        type: "ORDER_REJECTED",
        recipientType: "admin",
        recipientTelegramId: String(admin.telegramId),
        recipientId: admin.recipientId,
        text: adminText,
      });
    }
  }
}

module.exports = {
  buildOrderDetailsText,
  notifyAdminsNewOrder,
  notifyCouriersNewOrder,
  notifyCustomerOrderAccepted,
  notifyAdminCourierAccepted,
  notifyStatusChange,
  notifyPlaystationReturned,
  notifySingleCourierAssignment,
  notifyOrderRejected,
  sendLocation,
};
