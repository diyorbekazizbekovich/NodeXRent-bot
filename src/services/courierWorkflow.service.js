const { OrderStatus } = require("../constants/orderStatus");
const { isCourierPoolStatus, isTerminal } = require("../constants/orderTransitions");
const orderRepository = require("../repositories/order.repository");
const courierRepository = require("../repositories/courier.repository");
const playstationService = require("./playstation.service");
const deviceStatusService = require("./deviceStatus.service");
const { DeviceStatusError } = require("./deviceStatus.service");
const orderStatusManager = require("./orderStatus.manager");
const orderNotificationService = require("./orderNotification.service");
const orderWorkflowService = require("./orderWorkflow.service");
const { OrderAssignmentError } = require("../errors/order.errors");
const { OrderStatusError } = require("./orderStatus.manager");
const prisma = require("../config/prisma");
const logger = require("../utils/logger");

const ACTIVE_COURIER_STATUSES = [
  OrderStatus.COURIER_ASSIGNED,
  OrderStatus.ACCEPTED,
  OrderStatus.ON_THE_WAY,
  OrderStatus.ARRIVED,
  OrderStatus.DELIVERED,
  OrderStatus.ACTIVE,
  OrderStatus.RETURN_REQUESTED,
  OrderStatus.RETURN_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.EXPIRED,
];

function wrap(err) {
  if (err instanceof OrderStatusError) {
    return new OrderAssignmentError(err.code, err.message);
  }
  return err;
}

/**
 * Assign courier to order that already has a reserved InventoryUnit.
 * Does NOT search AVAILABLE inventory. Optional legacy Playstation claim is best-effort.
 */
async function claimReservedOrderForCourier(orderId, courierId, extra = {}) {
  const orderReservationService = require("./orderReservation.service");

  return prisma.$transaction(async (tx) => {
    const unit = await orderReservationService.getReservedUnitForOrder(tx, orderId);

    // Optional legacy: courier-owned Playstation row (not required for warehouse inventory)
    let playstationId = null;
    try {
      const orderRow = await tx.order.findUnique({
        where: { id: Number(orderId) },
        select: { consoleType: true, startDatetime: true, endDatetime: true },
      });
      const availablePs = await playstationService.findAvailableForCourier(
        courierId,
        orderRow.consoleType,
        orderRow.startDatetime,
        orderRow.endDatetime
      );
      if (availablePs) {
        try {
          await deviceStatusService.claimPlaystation(tx, availablePs.id, {
            orderId,
            reason: "ORDER_ASSIGN_OPTIONAL",
          });
          playstationId = availablePs.id;
        } catch (err) {
          if (!(err instanceof DeviceStatusError)) throw err;
          logger.warn("Optional courier Playstation claim skipped", {
            context: "CourierWorkflow",
            orderId,
            error: err.message,
          });
        }
      }
    } catch (err) {
      logger.warn("Optional Playstation lookup skipped", {
        context: "CourierWorkflow",
        orderId,
        error: err.message,
      });
    }

    try {
      const result = await orderStatusManager.claimOrderForCourier(tx, {
        orderId,
        courierId,
        playstationId,
        extra: {
          ...extra,
          inventoryUnitId: unit.id,
        },
      });
      if (result.count === 0) {
        if (playstationId) {
          await deviceStatusService.syncDeviceToOrderStatus(
            tx,
            { id: orderId, playstationId },
            OrderStatus.CANCELLED,
            { reason: "ASSIGN_ROLLBACK_PS_ONLY" }
          );
        }
        throw new OrderAssignmentError(
          "ALREADY_ACCEPTED",
          "Bu buyurtma boshqa kuryer tomonidan allaqachon qabul qilingan"
        );
      }

      await orderRepository.createStatusLog(
        orderId,
        OrderStatus.COURIER_ASSIGNED,
        {
          actorType: "courier",
          actorId: courierId,
          note: `Kuryer qabul qildi — inventar ${unit.unitCode} (RESERVED)`,
        },
        tx
      );

      return { unit, playstationId };
    } catch (err) {
      if (
        err?.code === "P2002" ||
        String(err?.message || "").includes("orders_unique_occupying_playstation") ||
        String(err?.message || "").includes("orders_unique_occupying_inventory_unit")
      ) {
        if (playstationId) {
          await deviceStatusService.syncDeviceToOrderStatus(
            tx,
            { id: orderId, playstationId },
            OrderStatus.CANCELLED,
            { reason: "UNIQUE_PS_ROLLBACK" }
          );
        }
        throw new OrderAssignmentError(
          "ALREADY_ACCEPTED",
          "Buyurtma yoki qurilma allaqachon boshqa kuryerga biriktirilgan"
        );
      }
      throw err;
    }
  });
}

/** @deprecated Use claimReservedOrderForCourier — kept for emergency admin assign API. */
async function assignWithRetry(orderId, courierId, order, { assignedByAdmin }) {
  await claimReservedOrderForCourier(orderId, courierId, { assignedByAdmin });
  return order.inventoryUnitId || null;
}

/**
 * Courier accepts ADMIN_CONFIRMED (or legacy ACCEPTED) order.
 */
async function acceptOrder(orderId, courierId) {
  const courier = await courierRepository.findById(courierId);
  if (!courier || !courier.isActive) {
    throw new OrderAssignmentError("COURIER_INACTIVE", "Kuryer faol emas");
  }

  let order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");

  if (order.courierId && order.courierId !== courierId) {
    throw new OrderAssignmentError(
      "ALREADY_ACCEPTED",
      "Bu buyurtma boshqa kuryer tomonidan allaqachon qabul qilingan"
    );
  }

  if (order.courierId === courierId && order.status === OrderStatus.COURIER_ASSIGNED) {
    return order;
  }

  if (!isCourierPoolStatus(order.status) || order.courierId) {
    throw new OrderAssignmentError(
      "NOT_AVAILABLE",
      "Faqat admin tasdiqlagan (ADMIN_CONFIRMED) buyurtmani qabul qilish mumkin"
    );
  }

  // Already declined by this courier?
  const prior = await prisma.orderCourierRejection.findUnique({
    where: { orderId_courierId: { orderId: Number(orderId), courierId: Number(courierId) } },
  });
  if (prior) {
    throw new OrderAssignmentError("FORBIDDEN", "Siz bu buyurtmani avval rad etgansiz");
  }

  // Legacy heal: ADMIN_CONFIRMED without unit (pre-reservation architecture)
  if (!order.inventoryUnitId) {
    const orderReservationService = require("./orderReservation.service");
    await prisma.$transaction(async (tx) => {
      await orderReservationService.reserveUnitForOrder(tx, {
        orderId,
        consoleType: order.consoleType,
        actorType: "system",
        actorId: courierId,
      });
    });
    order = await orderRepository.findById(orderId);
  }

  if (!order.inventoryUnitId) {
    throw new OrderAssignmentError(
      "NO_RESERVATION",
      "Buyurtmaga inventar biriktirilmagan. Admin qayta tasdiqlashi kerak."
    );
  }

  await claimReservedOrderForCourier(orderId, courierId, { assignedByAdmin: false });

  await prisma.order.update({
    where: { id: orderId },
    data: { isHighPriority: false },
  });

  const updated = await orderRepository.findById(orderId);

  try {
    await orderNotificationService.notifyCustomerOrderAccepted(updated);
    await orderNotificationService.notifyAdminCourierAccepted(updated);
    await orderNotificationService.notifyOtherCouriersOrderTaken(updated, courierId);
  } catch (err) {
    logger.warn("Accept notification xatoligi", { error: err.message, orderId });
  }

  return updated;
}

/**
 * Courier declines — re-queue to remaining couriers; never kill order unless none left.
 */
async function rejectOrder(orderId, courierId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");

  if (isTerminal(order.status)) {
    throw new OrderAssignmentError("NOT_AVAILABLE", `Buyurtma yakunlangan (${order.status})`);
  }

  if (
    [OrderStatus.DELIVERED, OrderStatus.ACTIVE, OrderStatus.RETURN_REQUESTED, OrderStatus.ON_THE_WAY, OrderStatus.ARRIVED].includes(
      order.status
    )
  ) {
    throw new OrderAssignmentError("NOT_AVAILABLE", `Bu bosqichda rad etib bo'lmaydi (${order.status})`);
  }

  if (order.courierId && order.courierId !== courierId) {
    throw new OrderAssignmentError("FORBIDDEN", "Bu buyurtma boshqa kuryerga biriktirilgan");
  }

  const courier = await courierRepository.findById(courierId);

  // If already assigned — release courier (+ optional Playstation) but KEEP reserved InventoryUnit
  if (order.courierId === courierId && order.status === OrderStatus.COURIER_ASSIGNED) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: orderId } });
      if (fresh?.playstationId) {
        await deviceStatusService.syncDeviceToOrderStatus(
          tx,
          { id: orderId, playstationId: fresh.playstationId },
          OrderStatus.CANCELLED,
          {
            actorType: "courier",
            actorId: courierId,
            reason: "COURIER_DECLINE_REQUEUE_PS_ONLY",
          }
        );
      }
      // InventoryUnit stays RESERVED + inventoryUnitId stays on order for next courier
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.ADMIN_CONFIRMED,
          courierId: null,
          playstationId: null,
          acceptedAt: null,
          assignedAt: null,
          assignedByAdmin: false,
        },
      });
      await orderRepository.createStatusLog(
        orderId,
        OrderStatus.ADMIN_CONFIRMED,
        {
          actorType: "courier",
          actorId: courierId,
          note: "Kuryer rad etdi — inventar bron saqlanadi, qayta navbatga",
        },
        tx
      );
    });
  } else if (!isCourierPoolStatus(order.status) && order.status !== OrderStatus.PENDING) {
    // PENDING is admin-only; couriers shouldn't see it in new flow
    throw new OrderAssignmentError("NOT_AVAILABLE", "Bu holatda rad etib bo'lmaydi");
  }

  try {
    await prisma.orderCourierRejection.create({
      data: { orderId: Number(orderId), courierId: Number(courierId) },
    });
  } catch (err) {
    if (err?.code !== "P2002") throw err;
  }

  const updated = await orderRepository.findById(orderId);
  const remaining = await listEligibleCouriers(orderId);

  if (remaining.length === 0) {
    await orderNotificationService.notifyAdminsNoCourierAvailable(updated, {
      lastCourierName: courier?.fullName || "Kuryer",
    });
    return updated;
  }

  try {
    await orderNotificationService.notifyCouriersNewOrder(updated, {
      onlyCourierIds: remaining.map((c) => c.id),
    });
  } catch (err) {
    logger.warn("Re-queue notification xatoligi", { orderId, error: err.message });
  }

  return updated;
}

async function listEligibleCouriers(orderId) {
  const rejected = await prisma.orderCourierRejection.findMany({
    where: { orderId: Number(orderId) },
    select: { courierId: true },
  });
  const rejectedIds = new Set(rejected.map((r) => r.courierId));
  const active = await courierRepository.listActive();
  return active.filter((c) => !rejectedIds.has(c.id));
}

async function startOnTheWay(orderId, courierId) {
  return transitionOwned(orderId, courierId, OrderStatus.ON_THE_WAY, {
    timestamps: { deliveryStartedAt: new Date() },
    note: "Kuryer yo'lga chiqdi",
    notifyKey: "notify.onTheWay",
    label: "Kuryer yo'lga chiqdi",
  });
}

async function markArrived(orderId, courierId) {
  return transitionOwned(orderId, courierId, OrderStatus.ARRIVED, {
    note: "Kuryer yetib keldi",
    notifyKey: "notify.arrived",
    label: "Kuryer yetib keldi",
  });
}

async function transitionOwned(orderId, courierId, toStatus, { timestamps = {}, note, notifyKey, label }) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  if (order.courierId !== courierId) {
    throw new OrderAssignmentError("FORBIDDEN", "Bu buyurtma sizga tegishli emas");
  }

  let updated;
  try {
    updated = await orderStatusManager.transitionOrderStatus({
      orderId,
      toStatus,
      actorType: "courier",
      actorId: courierId,
      note,
      timestamps,
    });
  } catch (err) {
    throw wrap(err);
  }

  const { t, resolveLang } = require("../i18n");
  const userLang = resolveLang(updated.user?.language);
  const customerText = notifyKey
    ? t(notifyKey, userLang, { id: orderId })
    : t("notify.statusDefault", userLang, { id: orderId, status: label });

  await orderNotificationService.notifyStatusChange(updated, label, {
    customerText,
    adminText: `📦 #${orderId} — ${label} (kuryer: ${order.courier?.fullName || "—"})`,
  });

  return orderRepository.findById(orderId);
}

async function cancelByCourier(orderId, courierId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  if (order.courierId !== courierId) {
    throw new OrderAssignmentError("FORBIDDEN", "Bu buyurtma sizga tegishli emas");
  }
  if (isTerminal(order.status)) {
    throw new OrderAssignmentError("NOT_AVAILABLE", `Buyurtma allaqachon yakunlangan (${order.status})`);
  }

  const updated = await orderWorkflowService.terminateWithRelease({
    orderId,
    status: OrderStatus.CANCELLED,
    actorType: "courier",
    actorId: courierId,
    note: "Kuryer buyurtmani bekor qildi",
    reason: "COURIER_CANCEL",
  });

  await orderWorkflowService.clearCourierQueue(orderId);

  const { t, resolveLang } = require("../i18n");
  const userLang = resolveLang(updated.user?.language);
  await orderNotificationService.notifyStatusChange(updated, "Bekor qilindi", {
    customerText: t("notify.cancelled", userLang, { id: orderId }),
    adminText: `📦 #${orderId} — Bekor qilindi (kuryer: ${order.courier?.fullName || "—"})`,
  });

  return updated;
}

/**
 * Legacy path helper used by updateCourierOrderStatus for RETURNED/COMPLETED/DELIVERED.
 */
async function updateOwnedStatus(orderId, courierId, status) {
  if (status === OrderStatus.CANCELLED) {
    return cancelByCourier(orderId, courierId);
  }
  if (status === OrderStatus.ON_THE_WAY) {
    return startOnTheWay(orderId, courierId);
  }
  if (status === OrderStatus.ARRIVED) {
    return markArrived(orderId, courierId);
  }

  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  if (order.courierId !== courierId) {
    throw new OrderAssignmentError("FORBIDDEN", "Bu buyurtma sizga tegishli emas");
  }

  const timestamps = {};
  if (status === OrderStatus.COMPLETED) timestamps.deliveryCompletedAt = new Date();
  if (status === OrderStatus.DELIVERED && !order.paymentReceived) {
    timestamps.deliveryCompletedAt = new Date();
  }

  if (status === OrderStatus.RETURNED || status === OrderStatus.COMPLETED) {
    throw new OrderAssignmentError(
      "FORBIDDEN",
      "Kuryer buyurtmani yakunlay olmaydi. Avval qaytarish so'rovi va admin tekshiruvi kerak."
    );
  }

  let updated;
  try {
    updated = await orderStatusManager.transitionOrderStatus({
      orderId,
      toStatus: status,
      actorType: "courier",
      actorId: courierId,
      note: `Status: ${status}`,
      timestamps,
    });
  } catch (err) {
    throw wrap(err);
  }

  if (status === OrderStatus.DELIVERED && !order.inventoryUnitId) {
    const inventoryService = require("./inventory.service");
    const inventoryAssetService = require("./inventoryAsset.service");
    const unit = await inventoryService.assignUnitToOrder(orderId, order.consoleType, {
      actorType: "courier",
      actorId: courierId,
    });
    if (unit) {
      await prisma.$transaction(async (tx) => {
        const withUnit = await orderRepository.findById(orderId);
        // Late assign at delivery: RESERVED → RENTED
        await inventoryAssetService.markRented(tx, unit.id, {
          orderId,
          actorType: "courier",
          actorId: courierId,
          reason: "DELIVERED_LATE_ASSIGN",
        });
        await deviceStatusService.syncDeviceToOrderStatus(tx, withUnit, status, {
          actorType: "courier",
          actorId: courierId,
          reason: "DELIVERED_UNIT",
        });
      });
    }
  }

  const labels = {
    DELIVERED: "Yetkazib berildi",
    RETURNED: "Qaytarildi",
    COMPLETED: "Yakunlandi",
  };

  const { t, resolveLang } = require("../i18n");
  const userLang = resolveLang(updated.user?.language);
  const customerKey = {
    DELIVERED: "notify.delivered",
    RETURN_REQUESTED: "notify.returnRequested",
  }[status];
  const customerText = customerKey
    ? t(customerKey, userLang, { id: orderId })
    : t("notify.statusDefault", userLang, { id: orderId, status: labels[status] || status });

  await orderNotificationService.notifyStatusChange(updated, labels[status] || status, {
    customerText,
    adminText: `📦 #${orderId} — ${labels[status] || status} (kuryer: ${order.courier?.fullName || "—"})`,
  });

  return orderRepository.findById(orderId);
}

async function listCourierDashboard(courierId) {
  const [pool, active, completed, cancelled] = await Promise.all([
    orderRepository.listByStatuses([OrderStatus.ADMIN_CONFIRMED, OrderStatus.ACCEPTED]),
    orderRepository.listByCourierAndStatuses(courierId, ACTIVE_COURIER_STATUSES),
    orderRepository.listByCourierAndStatuses(courierId, [OrderStatus.COMPLETED, OrderStatus.RETURNED]),
    orderRepository.listByCourierAndStatuses(courierId, [OrderStatus.CANCELLED]),
  ]);

  const rejected = await prisma.orderCourierRejection.findMany({
    where: { courierId: Number(courierId) },
    select: { orderId: true },
  });
  const rejectedSet = new Set(rejected.map((r) => r.orderId));

  return {
    newOrders: pool.filter((o) => !o.courierId && !rejectedSet.has(o.id)),
    acceptedOrders: active,
    completedOrders: completed,
    cancelledOrders: cancelled,
    stats: await courierRepository.getStats(courierId),
  };
}

module.exports = {
  acceptOrder,
  rejectOrder,
  startOnTheWay,
  markArrived,
  cancelByCourier,
  updateOwnedStatus,
  listCourierDashboard,
  listEligibleCouriers,
  ACTIVE_COURIER_STATUSES,
  claimReservedOrderForCourier,
  /** @deprecated alias */
  claimPlaystationAndAssign: claimReservedOrderForCourier,
  assignWithRetry,
};
