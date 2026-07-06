const prisma = require("../config/prisma");
const orderRepository = require("../repositories/order.repository");
const { filterGroup } = require("../constants/orderStatus");
const orderAssignmentService = require("./orderAssignment.service");
const pricingService = require("./pricing.service");
const settingsService = require("./settings.service");
const deliveryZoneService = require("./deliveryZone.service");
const paymentService = require("./payment.service");
const customerRepository = require("../repositories/customer.repository");
const { addHours } = require("../utils/dateHelper");

/**
 * Yangi buyurtma yaratadi va barcha admin/kuryerlarga xabar yuboradi.
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
  const rental = await pricingService.getRentalPriceById(rentalPriceId);
  if (rental.consoleType !== consoleType) {
    throw new Error("Tanlangan narx konsol turiga mos kelmaydi");
  }

  const start = new Date(startDatetime);
  if (isNaN(start.getTime())) throw new Error("Boshlanish vaqti noto'g'ri");

  const endDatetime = addHours(start, rental.duration);

  let promo = null;
  if (promocode && promocode.valid) promo = promocode.promo;

  const totalPrice = pricingService.calculateTotalPrice(rental.price, promo);
  const deliveryFee = await deliveryZoneService.getFeeByCode(deliveryZoneService.DEFAULT_ZONE);

  const resolvedAddress =
    address ||
    (userLat != null && userLon != null
      ? `Lokatsiya: ${Number(userLat).toFixed(5)}, ${Number(userLon).toFixed(5)}`
      : "Manzil ko'rsatilmagan");

  const order = await orderRepository.create({
    userId,
    consoleType,
    address: resolvedAddress,
    latitude: userLat,
    longitude: userLon,
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
  });

  await orderRepository.createStatusLog(order.id, "PENDING", {
    actorType: "system",
    note: "Buyurtma yaratildi",
  });

  if (promo) {
    await pricingService.incrementPromocodeUsage(promo.id);
  }

  const fullOrder = await orderRepository.findById(order.id);
  await paymentService.initOrderPayment(fullOrder);
  await customerRepository.touchActivity(userId);
  await orderAssignmentService.broadcastNewOrder(fullOrder);

  return { order: fullOrder, candidate: null };
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
    include: { rentalPrice: true, courier: true },
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
  changeStatus,
  listUserOrders,
  listCourierActiveOrders,
  listOrdersByStatus,
  listOrdersByFilter,
};
