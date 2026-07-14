const prisma = require("../config/prisma");
const orderRepository = require("../repositories/order.repository");
const { filterGroup, USER_OPEN_ORDER_STATUSES } = require("../constants/orderStatus");
const orderAssignmentService = require("./orderAssignment.service");
const pricingService = require("./pricing.service");
const settingsService = require("./settings.service");
const deliveryZoneService = require("./deliveryZone.service");
const paymentService = require("./payment.service");
const customerRepository = require("../repositories/customer.repository");
const geoFenceService = require("./geoFence.service");
const { GeoFenceError } = require("../errors/geoFence.errors");
const { ActiveOrderExistsError } = require("../errors/order.errors");
const { addHours } = require("../utils/dateHelper");
const { validateStartDatetime } = require("../validators/orderDatetime.validator");

/**
 * Yangi buyurtma yaratadi va barcha admin/kuryerlarga xabar yuboradi.
 * Bir foydalanuvchida bir vaqtda faqat bitta ochiq buyurtma bo'lishi mumkin (DB lock).
 */
async function createOrder({
  userId,
  userLat,
  userLon,
  address,
  consoleType,
  rentalPriceId,
  startDatetime,
  promocode,
  depositAmount = 0,
}) {
  // Hard backend geofence — Telegram / API cannot bypass
  try {
    geoFenceService.assertInsideServiceArea(userLat, userLon);
  } catch (err) {
    if (err instanceof GeoFenceError) {
      const e = new Error(err.message);
      e.messageKey = err.messageKey;
      e.code = err.code;
      throw e;
    }
    throw err;
  }

  const rental = await pricingService.getRentalPriceById(rentalPriceId);
  if (!rental.isActive) {
    const err = new Error("Tanlangan ijara narxi endi mavjud emas");
    err.messageKey = "orderErrors.priceGone";
    throw err;
  }
  if (rental.consoleType !== consoleType) {
    const err = new Error("Tanlangan narx konsol turiga mos kelmaydi");
    err.messageKey = "orderErrors.priceMismatch";
    throw err;
  }

  const activeConsoles = await pricingService.listActiveConsoles();
  if (!activeConsoles.some((c) => c.code === consoleType)) {
    const err = new Error("Tanlangan konsol hozir mavjud emas");
    err.messageKey = "orderErrors.consoleGone";
    throw err;
  }

  // Physical stock: must have AVAILABLE InventoryUnit
  const inventoryService = require("./inventory.service");
  await inventoryService.assertCanAcceptOrder(consoleType);

  const timeValidation = validateStartDatetime(startDatetime);
  if (!timeValidation.valid) {
    const err = new Error(timeValidation.reason);
    err.messageKey =
      timeValidation.code === "PAST_TIME"
        ? "datetime.pastTime"
        : timeValidation.code === "PAST_DATE"
          ? "datetime.pastDate"
          : timeValidation.code === "OUTSIDE_HOURS"
            ? "datetime.outsideHours"
            : timeValidation.code === "NOT_FULL_HOUR"
              ? "datetime.fullHourOnly"
              : "datetime.invalidStart";
    throw err;
  }

  const start = timeValidation.start;
  const endDatetime = addHours(start, rental.duration);

  let promo = null;
  if (promocode && promocode.valid) promo = promocode.promo;

  const totalPrice = pricingService.calculateTotalPrice(rental.price, promo);
  const deliveryFee = await deliveryZoneService.getFeeByCode(deliveryZoneService.DEFAULT_ZONE);

  const resolvedAddress =
    address ||
    (userLat != null && userLon != null
      ? `Lokatsiya: ${Number(userLat).toFixed(5)}, ${Number(userLon).toFixed(5)}`
      : "Manzil ko'rsatilmagan"); // stored value; UI uses i18n separately

  const order = await prisma.$transaction(async (tx) => {
    // Serialize concurrent createOrder for the same user (race-safe)
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${Number(userId)} FOR UPDATE`;

    const open = await orderRepository.findOpenOrderForUser(userId, USER_OPEN_ORDER_STATUSES, tx);
    if (open) {
      throw new ActiveOrderExistsError(open.id);
    }

    const created = await tx.order.create({
      data: {
        userId,
        consoleType,
        address: resolvedAddress,
        latitude: Number(userLat),
        longitude: Number(userLon),
        rentalPriceId,
        promocodeId: promo ? promo.id : null,
        startDatetime: start,
        endDatetime,
        totalPrice,
        deliveryFee,
        deliveryZoneCode: deliveryZoneService.DEFAULT_ZONE,
        depositAmount: depositAmount || 0,
        status: "PENDING",
        playstationId: null,
        courierId: null,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: created.id,
        status: "PENDING",
        actorType: "system",
        note: "Buyurtma yaratildi",
      },
    });

    if (promo) {
      await tx.promocode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    return created;
  });

  const fullOrder = await orderRepository.findById(order.id);
  await paymentService.initOrderPayment(fullOrder);
  await customerRepository.touchActivity(userId);
  await orderAssignmentService.broadcastNewOrder(fullOrder);

  return { order: fullOrder, candidate: null };
}

async function getOpenOrderForUser(userId) {
  return orderRepository.findOpenOrderForUser(userId, USER_OPEN_ORDER_STATUSES);
}

async function getOrderById(orderId) {
  return orderRepository.findById(orderId);
}

async function changeStatus(orderId, status, meta) {
  return orderAssignmentService.updateOrderStatus(orderId, status, meta);
}

async function listUserOrders(userId, { take = 10 } = {}) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      rentalPrice: true,
      courier: true,
      promocode: true,
      extensions: { orderBy: { requestedAt: "asc" } },
      statusLogs: { orderBy: { changedAt: "asc" } },
      inventoryUnit: true,
    },
  });
}

async function listCourierActiveOrders(courierId) {
  return orderRepository.listByCourierAndStatuses(courierId, orderAssignmentService.ACTIVE_COURIER_STATUSES);
}

async function listOrdersByStatus(status, options) {
  return orderRepository.listByStatus(status, options);
}

async function listOrdersByFilter(filterKey, options) {
  if (filterKey === "ALL") {
    return orderRepository.listByStatuses(
      [
        "PENDING",
        "COURIER_ASSIGNED",
        "ACCEPTED",
        "ON_THE_WAY",
        "ARRIVED",
        "DELIVERED",
        "RETURN_REQUESTED",
        "RETURNED",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
      ],
      options
    );
  }
  const group = filterGroup(filterKey);
  if (!group) return orderRepository.listByStatus(filterKey, options);
  return orderRepository.listByStatuses(group.statuses, options);
}

module.exports = {
  createOrder,
  getOrderById,
  getOpenOrderForUser,
  changeStatus,
  listUserOrders,
  listCourierActiveOrders,
  listOrdersByStatus,
  listOrdersByFilter,
};
