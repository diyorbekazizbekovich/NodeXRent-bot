const { formatDatetime } = require("../utils/dateHelper");
const pricingService = require("./pricing.service");
const { notify, sendToTelegram, sendTelegramLocation } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const { label } = require("../constants/orderStatus");
const adminOrderKeyboards = require("../bot/keyboards/admin.order.keyboards");
const courierKeyboards = require("../bot/keyboards/courier.keyboards");
const logger = require("../utils/logger");
const { escapeHtml } = require("../utils/telegramFormat");

function formatUsername(username) {
  if (!username) return "—";
  return `@${escapeHtml(String(username).replace(/^@/, ""))}`;
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
    `👤 Mijoz: ${escapeHtml(user?.fullName || "—")}\n` +
    `🔗 Username: ${formatUsername(user?.username)}\n` +
    `🆔 Telegram ID: ${escapeHtml(user?.telegramId || "—")}\n` +
    `📱 Telefon: ${escapeHtml(user?.phone || "—")}\n` +
    `📍 Manzil: ${escapeHtml(order.address || "—")}\n` +
    `🗺 Lokatsiya: ${formatLocation(order)}\n` +
    `🎮 Konsol: ${escapeHtml(order.consoleType)}\n` +
    (unitCode ? `🏷 Qurilma: <b>${escapeHtml(unitCode)}</b>\n` : "") +
    `⏱ Muddat: ${escapeHtml(duration)} soat\n` +
    `💵 Ijara narxi: ${escapeHtml(pricingService.formatMoney(rentalPrice, rental?.currency || "UZS"))}\n` +
    `🚚 Yetkazib berish: ${escapeHtml(pricingService.formatMoney(deliveryFee, rental?.currency || "UZS"))}\n` +
    (deposit > 0
      ? `🔒 Depozit: ${escapeHtml(pricingService.formatMoney(deposit, rental?.currency || "UZS"))}\n`
      : "") +
    `💰 Jami: ${escapeHtml(pricingService.formatMoney(grandTotal, rental?.currency || "UZS"))}\n` +
    `🕒 Boshlanish: ${escapeHtml(formatDatetime(order.startDatetime))}\n` +
    `📅 Yaratilgan: ${escapeHtml(formatDatetime(order.createdAt))}\n` +
    `📌 Status: <b>${escapeHtml(label(order.status))}</b>`
  );
}

async function notifyAdminsNewOrder(order) {
  const text = buildOrderDetailsText(order);
  const orderConfirmationService = require("./orderConfirmation.service");
  const confirmAllowed = orderConfirmationService.canConfirmOrder(order);
  const options = adminOrderKeyboards.newOrderKeyboard(order.id, {
    confirmAllowed,
    highPriority: Boolean(order.isHighPriority),
  });
  const prefix = confirmAllowed
    ? ""
    : `⏳ <b>Tasdiqlash</b> buyurtma boshlanishiga ${orderConfirmationService.confirmWindowHours()} soat qolganda ochiladi.\n\n`;
  const admins = await getAdminRecipients();

  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "ORDER_CREATED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text: prefix + text,
      options,
    });
  }
}

async function notifyCouriersNewOrder(order, { onlyCourierIds = null } = {}) {
  const text =
    `✅ <b>Admin tasdiqladi — yangi buyurtma</b>\n\n` + buildOrderDetailsText(order);

  let couriers = await require("../repositories/courier.repository").listActive();
  if (onlyCourierIds) {
    const set = new Set(onlyCourierIds.map(Number));
    couriers = couriers.filter((c) => set.has(c.id));
  } else {
    try {
      const rejected = await require("../config/prisma").orderCourierRejection.findMany({
        where: { orderId: Number(order.id) },
        select: { courierId: true },
      });
      const rejectedIds = new Set(rejected.map((r) => r.courierId));
      couriers = couriers.filter((c) => !rejectedIds.has(c.id));
    } catch (_) {
      /* table may not exist yet during migrate */
    }
  }

  for (const courier of couriers) {
    await notify({
      orderId: order.id,
      type: "ORDER_CREATED",
      recipientType: "courier",
      recipientTelegramId: courier.telegramId.toString(),
      recipientId: courier.id,
      text,
      options: courierKeyboards.newOrderKeyboard(order.id, order.latitude, order.longitude, {
        confirmAllowed: true,
        highPriority: Boolean(order.isHighPriority),
      }),
    });
  }
}

async function notifyOtherCouriersOrderTaken(order, acceptedCourierId) {
  const couriers = await require("../repositories/courier.repository").listActive();
  const text =
    `ℹ️ Buyurtma <b>#${order.id}</b> boshqa kuryer tomonidan qabul qilindi.\n` +
    `Bu buyurtma endi sizning navbatingizda emas.`;

  for (const courier of couriers) {
    if (Number(courier.id) === Number(acceptedCourierId)) continue;
    await notify({
      orderId: order.id,
      type: "ORDER_ACCEPTED",
      recipientType: "courier",
      recipientTelegramId: courier.telegramId.toString(),
      recipientId: courier.id,
      text,
      options: { parse_mode: "HTML" },
    });
  }
}

async function notifyAdminsNoCourierAvailable(order, { lastCourierName } = {}) {
  const text =
    `⚠️ <b>Kuryer topilmadi</b>\n\n` +
    `Buyurtma <b>#${order.id}</b> admin tasdiqlangan, lekin barcha mos kuryerlar rad etdi` +
    (lastCourierName ? ` (oxirgi: ${escapeHtml(lastCourierName)})` : "") +
    `.\n\nStatus: <b>ADMIN_CONFIRMED</b> — qo'lda aralashuv kerak.`;

  const admins = await getAdminRecipients();
  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "ORDER_REJECTED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text,
      options: { parse_mode: "HTML" },
    });
  }
}

async function notifyCustomerOrderAccepted(order) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(order.user?.language);
  const courier = order.courier;
  const courierName = escapeHtml(courier?.fullName || "—");
  const courierPhone = escapeHtml(courier?.phone || "—");

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
    `🚚 Kuryer: ${escapeHtml(courier?.fullName || "—")}\n` +
    `📱 Telefon: ${escapeHtml(courier?.phone || "—")}\n` +
    `🕒 Qabul vaqti: ${escapeHtml(formatDatetime(order.acceptedAt || new Date()))}`;

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
  const safeStatus = escapeHtml(statusLabel);
  const defaultCustomer = t("notify.statusDefault", L, { id: order.id, status: safeStatus });
  const defaultAdmin = `📦 Buyurtma #${order.id} — ${safeStatus}`;

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
  const customerText = t("notify.returned", L, { id: order.id, unit: escapeHtml(unitCode) });

  const adminText =
    `↩️ <b>PlayStation qaytarildi</b>\n\n` +
    `Buyurtma: #${order.id}\n` +
    `Qurilma: ${escapeHtml(unitCode)}\n` +
    `Mijoz: ${escapeHtml(order.user?.fullName || "—")}\n` +
    `Kuryer: ${escapeHtml(order.courier?.fullName || "—")}`;

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

function googleMapsUrl(latitude, longitude) {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

function buildLocationUpdateText(order, { forCourier = false } = {}) {
  const lat = Number(order.latitude);
  const lon = Number(order.longitude);
  const maps = googleMapsUrl(lat, lon);
  const customer = escapeHtml(order.user?.fullName || order.user?.phone || "—");

  let text =
    `📍 <b>Yetkazib berish manzili yangilandi</b>\n\n` +
    `📦 Buyurtma: <b>#${order.id}</b>\n` +
    `👤 Mijoz: ${customer}\n` +
    `📌 Status: <b>${escapeHtml(label(order.status))}</b>\n\n` +
    `🗺 Yangi koordinatalar:\n` +
    `• Latitude: <code>${lat.toFixed(6)}</code>\n` +
    `• Longitude: <code>${lon.toFixed(6)}</code>\n` +
    `• Manzil: ${escapeHtml(order.address || "—")}\n\n` +
    `🔗 <a href="${maps}">Google Maps</a>`;

  if (forCourier) {
    text +=
      `\n\n⚠️ Mijoz yetkazib berish lokatsiyasini o'zgartirdi.\n` +
      `Iltimos, yangi manzilga boring.`;
  }

  return text;
}

/**
 * Kuryer (agar biriktirilgan) + adminlarga yangi lokatsiya.
 * Kuryerga native pin ham yuboriladi — ochiq xarita yangilanadi.
 */
async function notifyLocationUpdated(order) {
  const lat = order.latitude;
  const lon = order.longitude;
  if (lat == null || lon == null) {
    logger.warn("notifyLocationUpdated: coords missing", { orderId: order.id });
    return;
  }

  if (order.courier?.telegramId) {
    const courierText = buildLocationUpdateText(order, { forCourier: true });
    const sent = await notify({
      orderId: order.id,
      type: "LOCATION_UPDATED",
      recipientType: "courier",
      recipientTelegramId: order.courier.telegramId.toString(),
      recipientId: order.courier.id,
      text: courierText,
      options: {
        parse_mode: "HTML",
        disable_web_page_preview: false,
        ...courierKeyboards.locationUpdateKeyboard(order.id, lat, lon),
      },
    });
    if (sent) {
      await sendTelegramLocation(order.courier.telegramId, lat, lon);
    } else {
      logger.warn("Courier offline or unreachable for location update", {
        context: "OrderNotification",
        orderId: order.id,
        courierId: order.courier.id,
      });
    }
  } else {
    logger.info("Location updated — courier not assigned yet", {
      context: "OrderNotification",
      orderId: order.id,
    });
  }

  const adminText = buildLocationUpdateText(order, { forCourier: false });
  const admins = await getAdminRecipients();
  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "LOCATION_UPDATED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text: adminText,
      options: { parse_mode: "HTML", disable_web_page_preview: false },
    });
  }
}

async function sendLocation(chatId, latitude, longitude) {
  await sendToTelegram(chatId, `📍 <a href="${googleMapsUrl(latitude, longitude)}">Xaritada ochish</a>`, {
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
      `🚚 Kuryer: ${escapeHtml(courierName || "—")}\n` +
      `👤 Mijoz: ${escapeHtml(order.user?.fullName || "—")}\n` +
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
  notifyOtherCouriersOrderTaken,
  notifyAdminsNoCourierAvailable,
  notifyCustomerOrderAccepted,
  notifyAdminCourierAccepted,
  notifyStatusChange,
  notifyPlaystationReturned,
  notifySingleCourierAssignment,
  notifyOrderRejected,
  notifyLocationUpdated,
  sendLocation,
  googleMapsUrl,
};
