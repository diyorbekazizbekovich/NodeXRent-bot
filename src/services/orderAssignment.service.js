const orderRepository = require("../repositories/order.repository");
const playstationService = require("./playstation.service");
const inventoryService = require("./inventory.service");
const orderNotificationService = require("./orderNotification.service");
const auditLogService = require("./auditLog.service");
const { OrderAssignmentError } = require("../errors/order.errors");
const courierRepository = require("../repositories/courier.repository");

const ACTIVE_COURIER_STATUSES = [
  "COURIER_ASSIGNED",
  "ACCEPTED",
  "ON_THE_WAY",
  "ARRIVED",
  "DELIVERED",
  "ACTIVE",
  "RETURN_REQUESTED",
];

async function broadcastNewOrder(order) {
  await orderNotificationService.notifyAdminsNewOrder(order);
  await orderNotificationService.notifyCouriersNewOrder(order);
}

async function acceptOrderByCourier(orderId, courierId) {
  const courier = await courierRepository.findById(courierId);
  if (!courier || !courier.isActive) {
    throw new OrderAssignmentError("COURIER_INACTIVE", "Kuryer faol emas");
  }

  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");

  if (order.courierId && order.courierId !== courierId) {
    throw new OrderAssignmentError(
      "ALREADY_ACCEPTED",
      "Bu buyurtma boshqa kuryer tomonidan allaqachon qabul qilingan"
    );
  }

  if (order.status !== "PENDING" || order.courierId) {
    if (order.courierId === courierId) {
      return order;
    }
    throw new OrderAssignmentError("NOT_AVAILABLE", "Buyurtma endi mavjud emas");
  }

  const available = await playstationService.findAvailableForCourier(
    courierId,
    order.consoleType,
    order.startDatetime,
    order.endDatetime
  );
  const playstationId = available?.id ?? null;

  const result = await orderRepository.tryAssignCourier(orderId, courierId, playstationId, {
    assignedByAdmin: false,
  });

  if (result.count === 0) {
    throw new OrderAssignmentError(
      "ALREADY_ACCEPTED",
      "Bu buyurtma boshqa kuryer tomonidan allaqachon qabul qilingan"
    );
  }

  if (playstationId) {
    await playstationService.setStatus(playstationId, "RENTED");
  }

  await orderRepository.createStatusLog(orderId, "COURIER_ASSIGNED", {
    actorType: "courier",
    actorId: courierId,
    note: "Kuryer buyurtmani qabul qildi",
  });

  const updated = await orderRepository.findById(orderId);

  try {
    await orderNotificationService.notifyCustomerOrderAccepted(updated);
    await orderNotificationService.notifyAdminCourierAccepted(updated);
  } catch (err) {
    // Xabar yuborish xatosi buyurtma qabul qilishni bekor qilmasin
    require("../utils/logger").warn("Accept notification xatoligi", { error: err.message, orderId });
  }

  return updated;
}

const TERMINAL_STATUSES = new Set(["REJECTED", "COMPLETED", "CANCELLED", "EXPIRED"]);

function assertCanReject(order) {
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  if (order.status === "REJECTED") {
    throw new OrderAssignmentError("ALREADY_REJECTED", "Bu buyurtma allaqachon rad etilgan");
  }
  if (order.status === "COMPLETED") {
    throw new OrderAssignmentError("ALREADY_COMPLETED", "Yakunlangan buyurtmani rad etib bo'lmaydi");
  }
  if (TERMINAL_STATUSES.has(order.status) || ["DELIVERED", "ACTIVE", "RETURNED", "RETURN_REQUESTED"].includes(order.status)) {
    throw new OrderAssignmentError(
      "NOT_AVAILABLE",
      `Buyurtma holati (${order.status}) — rad etib bo'lmaydi`
    );
  }
  if (!["PENDING", "COURIER_ASSIGNED", "ACCEPTED"].includes(order.status)) {
    throw new OrderAssignmentError("NOT_AVAILABLE", "Bu holatda rad etib bo'lmaydi");
  }
}

async function rejectOrderByCourier(orderId, courierId) {
  const order = await orderRepository.findById(orderId);
  assertCanReject(order);

  if (order.courierId && order.courierId !== courierId) {
    throw new OrderAssignmentError("FORBIDDEN", "Bu buyurtma boshqa kuryerga biriktirilgan");
  }

  const courier = await courierRepository.findById(courierId);

  if (order.playstationId) {
    await playstationService.setStatus(order.playstationId, "AVAILABLE");
  }
  await inventoryService.releaseUnit(orderId);

  const updated = await updateOrderStatus(orderId, "REJECTED", {
    actorType: "courier",
    actorId: courierId,
    note: "Kuryer buyurtmani rad etdi",
  });

  await orderNotificationService.notifyOrderRejected(updated, {
    by: "courier",
    courierName: courier?.fullName || "Kuryer",
  });

  return updated;
}

async function rejectOrderByAdmin(orderId, adminTelegramId) {
  const order = await orderRepository.findById(orderId);
  assertCanReject(order);

  if (order.playstationId) {
    await playstationService.setStatus(order.playstationId, "AVAILABLE");
  }
  await inventoryService.releaseUnit(orderId);

  const updated = await updateOrderStatus(orderId, "REJECTED", {
    actorType: "admin",
    actorId: adminTelegramId,
    note: "Admin buyurtmani rad etdi",
  });

  await orderNotificationService.notifyOrderRejected(updated, { by: "admin" });

  await auditLogService.log({
    adminTelegramId,
    action: "ORDER_REJECTED",
    entityType: "Order",
    entityId: orderId,
    afterData: { message: `Admin buyurtmani #${orderId} rad etdi` },
  });

  return updated;
}

async function assignOrderByAdmin(orderId, courierId) {
  const courier = await courierRepository.findById(courierId);
  if (!courier || !courier.isActive) {
    throw new OrderAssignmentError("COURIER_INACTIVE", "Kuryer faol emas");
  }

  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  if (order.status !== "PENDING" || order.courierId) {
    throw new OrderAssignmentError("NOT_AVAILABLE", "Buyurtma allaqachon biriktirilgan yoki yopilgan");
  }

  const available = await playstationService.findAvailableForCourier(
    courierId,
    order.consoleType,
    order.startDatetime,
    order.endDatetime
  );

  const result = await orderRepository.tryAssignCourier(orderId, courierId, available?.id ?? null, {
    assignedByAdmin: true,
  });

  if (result.count === 0) {
    throw new OrderAssignmentError("NOT_AVAILABLE", "Buyurtmani biriktirib bo'lmadi");
  }

  if (available?.id) {
    await playstationService.setStatus(available.id, "RENTED");
  }

  await orderRepository.createStatusLog(orderId, "COURIER_ASSIGNED", {
    actorType: "admin",
    actorId: courierId,
    note: "Admin tomonidan kuryer biriktirildi",
  });

  const updated = await orderRepository.findById(orderId);
  await orderNotificationService.notifySingleCourierAssignment(updated, courier);
  await orderNotificationService.notifyCustomerOrderAccepted(updated);
  await orderNotificationService.notifyAdminCourierAccepted(updated);
  return updated;
}

async function confirmOrderByAdmin(orderId, adminTelegramId) {
  return updateOrderStatus(orderId, "ACCEPTED", {
    actorType: "admin",
    actorId: adminTelegramId,
    note: "Admin buyurtmani tasdiqladi",
  });
}

async function cancelOrderByAdmin(orderId, adminTelegramId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");

  if (order.playstationId) {
    await playstationService.setStatus(order.playstationId, "AVAILABLE");
  }
  await inventoryService.releaseUnit(orderId);

  const updated = await updateOrderStatus(orderId, "CANCELLED", {
    actorType: "admin",
    actorId: adminTelegramId,
    note: "Admin buyurtmani bekor qildi",
  });

  const { t, resolveLang } = require("../i18n");
  const userLang = resolveLang(updated.user?.language);
  await orderNotificationService.notifyStatusChange(updated, "Bekor qilindi", {
    customerText: t("notify.cancelled", userLang, { id: orderId }),
    adminText: `❌ Buyurtma #${orderId} admin tomonidan bekor qilindi.`,
  });

  await auditLogService.log({
    adminTelegramId: adminTelegramId,
    action: "ORDER_CANCELLED",
    entityType: "Order",
    entityId: orderId,
    afterData: { message: `Admin buyurtmani #${orderId} bekor qildi` },
  });

  return updated;
}

async function updateOrderStatus(orderId, status, { actorType, actorId, note, timestamps = {} } = {}) {
  const order = await orderRepository.update(orderId, { status, ...timestamps });
  await orderRepository.createStatusLog(orderId, status, { actorType, actorId, note });
  return orderRepository.findById(orderId);
}

async function updateCourierOrderStatus(orderId, courierId, status) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  if (order.courierId !== courierId) {
    throw new OrderAssignmentError("FORBIDDEN", "Bu buyurtma sizga tegishli emas");
  }

  const timestamps = {};
  if (status === "ON_THE_WAY") timestamps.deliveryStartedAt = new Date();
  // deliveryCompletedAt faqat to'liq handover (completeHandover) da yoziladi
  if (status === "COMPLETED") timestamps.deliveryCompletedAt = new Date();
  // Eski yo'l: to'g'ridan-to'g'ri DELIVERED (handover tashqarisida) — timestamp saqlansin
  if (status === "DELIVERED" && !order.paymentReceived) {
    timestamps.deliveryCompletedAt = new Date();
  }

  const updated = await updateOrderStatus(orderId, status, {
    actorType: "courier",
    actorId: courierId,
    note: `Status: ${status}`,
    timestamps,
  });

  if (status === "DELIVERED" && !order.inventoryUnitId) {
    await inventoryService.assignUnitToOrder(orderId, order.consoleType);
  }

  const labels = {
    ON_THE_WAY: "Kuryer yo'lga chiqdi",
    ARRIVED: "Kuryer yetib keldi",
    DELIVERED: "Yetkazib berildi",
    RETURNED: "Qaytarildi",
    COMPLETED: "Yakunlandi",
    CANCELLED: "Bekor qilindi",
  };

  const { t, resolveLang } = require("../i18n");
  const userLang = resolveLang(updated.user?.language);
  const customerKey = {
    ON_THE_WAY: "notify.onTheWay",
    ARRIVED: "notify.arrived",
    DELIVERED: "notify.delivered",
    RETURN_REQUESTED: "notify.returnRequested",
    CANCELLED: "notify.cancelled",
  }[status];
  const customerText = customerKey
    ? t(customerKey, userLang, { id: orderId })
    : t("notify.statusDefault", userLang, { id: orderId, status: labels[status] || status });

  await orderNotificationService.notifyStatusChange(updated, labels[status] || status, {
    customerText,
    adminText: `📦 #${orderId} — ${labels[status] || status} (kuryer: ${order.courier?.fullName || "—"})`,
  });

  if (status === "RETURNED") {
    const withUnit = await orderRepository.findById(orderId);
    await orderNotificationService.notifyPlaystationReturned(withUnit);
  }

  if (status === "RETURNED" || status === "COMPLETED") {
    if (order.playstationId) {
      await playstationService.setStatus(order.playstationId, "AVAILABLE");
    }
    await inventoryService.releaseUnit(orderId);
  }

  if (status === "CANCELLED") {
    await inventoryService.releaseUnit(orderId);
  }

  return orderRepository.findById(orderId);
}

async function listCourierDashboard(courierId) {
  const [pending, active, completed, cancelled] = await Promise.all([
    orderRepository.listByStatus("PENDING"),
    orderRepository.listByCourierAndStatuses(courierId, ACTIVE_COURIER_STATUSES),
    orderRepository.listByCourierAndStatuses(courierId, ["COMPLETED", "RETURNED"]),
    orderRepository.listByCourierAndStatuses(courierId, ["CANCELLED"]),
  ]);

  return {
    newOrders: pending.filter((o) => !o.courierId),
    acceptedOrders: active,
    completedOrders: completed,
    cancelledOrders: cancelled,
    stats: await courierRepository.getStats(courierId),
  };
}

module.exports = {
  broadcastNewOrder,
  acceptOrderByCourier,
  rejectOrderByCourier,
  rejectOrderByAdmin,
  assignOrderByAdmin,
  confirmOrderByAdmin,
  cancelOrderByAdmin,
  updateCourierOrderStatus,
  listCourierDashboard,
  ACTIVE_COURIER_STATUSES,
};
