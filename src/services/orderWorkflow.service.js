const { OrderStatus } = require("../constants/orderStatus");
const { isTerminal } = require("../constants/orderTransitions");
const orderRepository = require("../repositories/order.repository");
const orderNotificationService = require("./orderNotification.service");
const orderStatusManager = require("./orderStatus.manager");
const orderResourceService = require("./orderResource.service");
const auditLogService = require("./auditLog.service");
const { OrderAssignmentError } = require("../errors/order.errors");
const { OrderStatusError } = require("./orderStatus.manager");
const prisma = require("../config/prisma");
const logger = require("../utils/logger");

function wrapStatusError(err) {
  if (err instanceof OrderStatusError) {
    return new OrderAssignmentError(err.code, err.message);
  }
  return err;
}

/**
 * New order created — notify admins only (couriers wait for admin confirm).
 */
async function onOrderCreated(order) {
  await orderNotificationService.notifyAdminsNewOrder(order);
}

/**
 * Admin confirms PENDING → ADMIN_CONFIRMED, then fan-out to courier pool.
 */
async function confirmByAdmin(orderId, adminTelegramId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");

  const orderConfirmationService = require("./orderConfirmation.service");
  orderConfirmationService.assertCanConfirmOrder(order);

  if (order.status !== OrderStatus.PENDING) {
    throw new OrderAssignmentError(
      "NOT_AVAILABLE",
      `Faqat PENDING buyurtmani tasdiqlash mumkin (hozir: ${order.status})`
    );
  }

  let updated;
  try {
    updated = await orderStatusManager.transitionOrderStatus({
      orderId,
      toStatus: OrderStatus.ADMIN_CONFIRMED,
      actorType: "admin",
      actorId: adminTelegramId,
      note: "Admin buyurtmani tasdiqladi — kuryer navbatiga yuborildi",
      timestamps: { confirmedAt: new Date(), isHighPriority: false },
      syncDevice: false,
    });
  } catch (err) {
    throw wrapStatusError(err);
  }

  await auditLogService.log({
    adminTelegramId,
    module: "ORDER_WORKFLOW",
    action: "ORDER_ADMIN_CONFIRMED",
    entityType: "Order",
    entityId: orderId,
    afterData: { status: OrderStatus.ADMIN_CONFIRMED },
  });

  try {
    await orderNotificationService.notifyCouriersNewOrder(updated);
  } catch (err) {
    logger.error("Courier fan-out xatoligi (admin confirm)", {
      context: "OrderWorkflow",
      orderId,
      error: err.message,
    });
    throw err;
  }

  return updated;
}

async function rejectByAdmin(orderId, adminTelegramId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");

  const rejectable = [
    OrderStatus.PENDING,
    OrderStatus.ADMIN_CONFIRMED,
    OrderStatus.ACCEPTED,
    OrderStatus.COURIER_ASSIGNED,
  ];
  if (!rejectable.includes(order.status) || isTerminal(order.status)) {
    throw new OrderAssignmentError(
      "NOT_AVAILABLE",
      `Bu holatda rad etib bo'lmaydi (${order.status})`
    );
  }

  const updated = await terminateWithRelease({
    orderId,
    status: OrderStatus.REJECTED,
    actorType: "admin",
    actorId: adminTelegramId,
    note: "Admin buyurtmani rad etdi",
    reason: "ADMIN_REJECT",
  });

  await clearCourierQueue(orderId);
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

async function cancelByAdmin(orderId, adminTelegramId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  if (isTerminal(order.status)) {
    throw new OrderAssignmentError("NOT_AVAILABLE", `Buyurtma allaqachon yakunlangan (${order.status})`);
  }

  const updated = await terminateWithRelease({
    orderId,
    status: OrderStatus.CANCELLED,
    actorType: "admin",
    actorId: adminTelegramId,
    note: "Admin buyurtmani bekor qildi",
    reason: "ADMIN_CANCEL",
  });

  await clearCourierQueue(orderId);

  const { t, resolveLang } = require("../i18n");
  const userLang = resolveLang(updated.user?.language);
  await orderNotificationService.notifyStatusChange(updated, "Bekor qilindi", {
    customerText: t("notify.cancelled", userLang, { id: orderId }),
    adminText: `❌ Buyurtma #${orderId} admin tomonidan bekor qilindi.`,
  });

  await auditLogService.log({
    adminTelegramId,
    action: "ORDER_CANCELLED",
    entityType: "Order",
    entityId: orderId,
    afterData: { message: `Admin buyurtmani #${orderId} bekor qildi` },
  });

  return updated;
}

async function cancelBySystem(orderId, { note = "Tizim bekor qildi", reason = "SYSTEM_CANCEL" } = {}) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  if (isTerminal(order.status)) return order;

  const updated = await terminateWithRelease({
    orderId,
    status: OrderStatus.CANCELLED,
    actorType: "system",
    actorId: null,
    note,
    reason,
  });

  await clearCourierQueue(orderId);

  const { t, resolveLang } = require("../i18n");
  const userLang = resolveLang(updated.user?.language);
  await orderNotificationService.notifyStatusChange(updated, "Bekor qilindi", {
    customerText: t("notify.cancelled", userLang, { id: orderId }),
    adminText: `❌ Buyurtma #${orderId} tizim tomonidan bekor qilindi (${reason}).`,
  });

  return updated;
}

async function terminateWithRelease({
  orderId,
  status,
  actorType,
  actorId,
  note,
  reason,
  timestamps = {},
}) {
  if (![OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(status)) {
    throw new Error(`terminateWithRelease: unsupported status ${status}`);
  }

  try {
    const id = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: Number(orderId) },
        include: orderResourceService.RELEASE_INCLUDE,
      });
      if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");

      if (isTerminal(order.status) && order.status !== status) {
        throw new OrderAssignmentError(
          "NOT_AVAILABLE",
          `Buyurtma allaqachon yakunlangan (${order.status})`
        );
      }
      if (order.status === status) return order.id;

      // Bypass matrix for terminal from any non-terminal via force path
      // Validate via transitions when possible; otherwise allow cancel/reject from mid-flow
      const { canTransition } = require("../constants/orderTransitions");
      if (!canTransition(order.status, status)) {
        // Mid-flow cancel always allowed for ops
        if (status !== OrderStatus.CANCELLED && status !== OrderStatus.REJECTED) {
          throw new OrderAssignmentError(
            "INVALID_TRANSITION",
            `${order.status} → ${status} taqiqlangan`
          );
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status, ...timestamps },
      });

      await orderRepository.createStatusLog(order.id, status, { actorType, actorId, note }, tx);

      await orderResourceService.releaseOrderResources(tx, order, {
        actorType,
        actorId,
        reason: reason || status,
      });

      await tx.orderCourierRejection.deleteMany({ where: { orderId: order.id } });

      return order.id;
    });

    return orderRepository.findById(id);
  } catch (err) {
    throw wrapStatusError(err);
  }
}

async function clearCourierQueue(orderId) {
  try {
    await prisma.orderCourierRejection.deleteMany({ where: { orderId: Number(orderId) } });
  } catch (err) {
    logger.warn("Courier rejection queue tozalanmadi", {
      context: "OrderWorkflow",
      orderId,
      error: err.message,
    });
  }
}

module.exports = {
  onOrderCreated,
  confirmByAdmin,
  rejectByAdmin,
  cancelByAdmin,
  cancelBySystem,
  terminateWithRelease,
  clearCourierQueue,
};
