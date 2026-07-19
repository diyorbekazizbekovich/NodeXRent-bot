const { OrderStatus } = require("../constants/orderStatus");
const {
  assertTransition,
  isTerminal,
  OrderStatusError,
} = require("../constants/orderTransitions");
const orderRepository = require("../repositories/order.repository");
const deviceStatusService = require("./deviceStatus.service");
const orderResourceService = require("./orderResource.service");
const auditLogService = require("./auditLog.service");
const logger = require("../utils/logger");
const prisma = require("../config/prisma");

/**
 * Central status transitions — every order status change should go through here.
 */
async function transitionOrderStatus({
  orderId,
  toStatus,
  actorType,
  actorId = null,
  note = null,
  timestamps = {},
  extraData = {},
  tx: outerTx = null,
  releaseResources = false,
  syncDevice = true,
  skipAudit = false,
}) {
  const run = async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: Number(orderId) },
      include: orderResourceService.RELEASE_INCLUDE,
    });
    if (!order) {
      throw new OrderStatusError("NOT_FOUND", "Buyurtma topilmadi");
    }

    const fromStatus = order.status;

    if (order.status === toStatus) {
      return { order, fromStatus, unchanged: true };
    }

    if (isTerminal(order.status) && order.status !== toStatus) {
      throw new OrderStatusError(
        "TERMINAL",
        `Buyurtma allaqachon yakunlangan (${order.status})`
      );
    }

    assertTransition(order.status, toStatus);

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: toStatus,
        ...timestamps,
        ...extraData,
      },
      include: orderResourceService.RELEASE_INCLUDE,
    });

    await orderRepository.createStatusLog(
      order.id,
      toStatus,
      { actorType, actorId, note },
      tx
    );

    if (releaseResources) {
      await orderResourceService.releaseOrderResources(tx, updated, {
        actorType,
        actorId,
        reason: note || toStatus,
      });
    } else if (syncDevice) {
      await deviceStatusService.syncDeviceToOrderStatus(tx, updated, toStatus, {
        actorType,
        actorId,
        reason: note || toStatus,
      });
    }

    return { order: updated, fromStatus };
  };

  const result = outerTx ? await run(outerTx) : await prisma.$transaction(run);
  const unchanged = Boolean(result.unchanged);
  const fromStatus = result.fromStatus;
  const orderIdNum = Number(orderId);

  if (!skipAudit && !unchanged) {
    try {
      await auditLogService.log({
        adminTelegramId: actorType === "admin" ? actorId : null,
        module: "ORDER_WORKFLOW",
        action: "ORDER_STATUS_CHANGED",
        entityType: "Order",
        entityId: orderIdNum,
        beforeData: { status: fromStatus },
        afterData: {
          toStatus,
          actorType,
          actorId,
          note,
        },
      });
    } catch (err) {
      logger.warn("Order status audit yozilmadi", {
        context: "OrderStatusManager",
        orderId,
        error: err.message,
      });
    }
  }

  return orderRepository.findById(orderId);
}

/**
 * Atomic claim: pool status + no courier → COURIER_ASSIGNED.
 * InventoryUnit must already be reserved on the order (admin approve).
 * playstationId is optional legacy (courier-owned device table) — not required.
 */
async function claimOrderForCourier(tx, { orderId, courierId, playstationId = null, extra = {} }) {
  const pool = [OrderStatus.ADMIN_CONFIRMED, OrderStatus.ACCEPTED];
  const data = {
    courierId: Number(courierId),
    status: OrderStatus.COURIER_ASSIGNED,
    acceptedAt: new Date(),
    assignedAt: new Date(),
    ...extra,
  };
  if (playstationId != null) {
    data.playstationId = Number(playstationId);
  }
  const result = await tx.order.updateMany({
    where: {
      id: Number(orderId),
      status: { in: pool },
      courierId: null,
    },
    data,
  });
  return result;
}

module.exports = {
  transitionOrderStatus,
  claimOrderForCourier,
  OrderStatusError,
};
