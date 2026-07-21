/**
 * Rental return lifecycle — request, assign, pickup, admin inspection.
 * Couriers cannot complete rental early or finalize inventory.
 */
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const auditLogService = require("./auditLog.service");
const orderStatusManager = require("./orderStatus.manager");
const { OrderStatusError } = require("./orderStatus.manager");
const {
  OrderStatus,
  COURIER_RETURN_ALLOWED_STATUSES,
} = require("../constants/orderStatus");
const { AssetStatus } = require("../constants/inventoryAsset");
const inventoryAssetService = require("./inventoryAsset.service");
const { addHours, formatRemainingDuration, formatDatetime } = require("../utils/dateHelper");
const { notify } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");

class RentalReturnError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RentalReturnError";
    this.code = code;
  }
}

function getExpectedReturnAt(order) {
  return order.expectedReturnAt || order.endDatetime;
}

function isRentalPeriodEnded(order, now = new Date()) {
  const end = getExpectedReturnAt(order);
  if (!end) return false;
  return new Date(now).getTime() >= new Date(end).getTime();
}

function assertRentalEnded(order, { force = false } = {}) {
  if (force) return;
  if (!isRentalPeriodEnded(order)) {
    const remaining = formatRemainingDuration(getExpectedReturnAt(order));
    throw new RentalReturnError(
      "RENTAL_NOT_ENDED",
      `Ijara muddati hali tugamagan. Qolgan vaqt: ${remaining}`
    );
  }
}

function assertCourierCanPickup(order, courierId) {
  if (!COURIER_RETURN_ALLOWED_STATUSES.includes(order.status)) {
    throw new RentalReturnError(
      "INVALID_STATUS",
      order.status === OrderStatus.ACTIVE || order.status === OrderStatus.DELIVERED
        ? "Ijara muddati hali tugamagan."
        : `Bu holatda qaytarib bo'lmaydi: ${order.status}`
    );
  }
  if (order.courierId !== Number(courierId)) {
    throw new RentalReturnError(
      "FORBIDDEN",
      "Bu qaytarish sizga biriktirilmagan"
    );
  }
}

/**
 * After handover: set rentalStartAt + expectedReturnAt from tariff duration.
 */
function computeRentalWindow(order, now = new Date()) {
  let durationHours = order.rentalPrice?.duration;
  if (!durationHours && order.startDatetime && order.endDatetime) {
    durationHours = Math.round(
      (new Date(order.endDatetime) - new Date(order.startDatetime)) / 3600000
    );
  }
  if (!durationHours || durationHours < 1) durationHours = 24;

  const rentalStartAt = now;
  const expectedReturnAt = addHours(now, durationHours);
  return { rentalStartAt, expectedReturnAt, durationHours };
}

async function logRentalAudit({
  action,
  orderId,
  inventoryUnitId,
  actorType,
  actorId,
  adminId,
  telegramId,
  extra = {},
}) {
  try {
    await auditLogService.log({
      module: "RENTAL_RETURN",
      adminId: adminId ?? (actorType === "admin" ? actorId : null),
      adminTelegramId: telegramId,
      action,
      entityType: "Order",
      entityId: orderId,
      afterData: {
        orderId,
        inventoryUnitId: inventoryUnitId ?? null,
        actorType,
        actorId: actorId ?? null,
        at: new Date().toISOString(),
        ...extra,
      },
    });
  } catch (err) {
    logger.warn("Rental audit log failed", { error: err.message, action, orderId });
  }
}

/**
 * Customer or admin creates RETURN_REQUESTED.
 * Customer: only after expectedReturnAt (or EXPIRED).
 * Admin: may force early with force=true.
 */
async function requestReturn(orderId, {
  actorType = "user",
  actorId = null,
  userId = null,
  force = false,
  adminContext = {},
  note = null,
} = {}) {
  const order = await prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: { user: true, courier: true, inventoryUnit: true },
  });
  if (!order) throw new RentalReturnError("NOT_FOUND", "Buyurtma topilmadi");

  if (actorType === "user" && userId != null && order.userId !== Number(userId)) {
    throw new RentalReturnError("FORBIDDEN", "Bu buyurtma sizniki emas");
  }

  const allowedFrom = [
    OrderStatus.ACTIVE,
    OrderStatus.DELIVERED,
    OrderStatus.EXPIRED,
  ];
  if (!allowedFrom.includes(order.status)) {
    throw new RentalReturnError(
      "INVALID_STATUS",
      `Qaytarish so'rovi mumkin emas: ${order.status}`
    );
  }

  assertRentalEnded(order, { force: force && actorType === "admin" });

  let updated;
  try {
    updated = await orderStatusManager.transitionOrderStatus({
      orderId: order.id,
      toStatus: OrderStatus.RETURN_REQUESTED,
      actorType,
      actorId,
      note: note || (force ? "Admin majburiy qaytarish so'rovi" : "Qaytarish so'rovi"),
    });
  } catch (err) {
    if (err instanceof OrderStatusError) {
      throw new RentalReturnError(err.code, err.message);
    }
    throw err;
  }

  await logRentalAudit({
    action: "RETURN_REQUESTED",
    orderId: order.id,
    inventoryUnitId: order.inventoryUnitId,
    actorType,
    actorId,
    adminId: adminContext.adminId,
    telegramId: adminContext.telegramId,
    extra: { force: Boolean(force) },
  });

  try {
    const admins = await getAdminRecipients();
    for (const a of admins) {
      await notify({
        orderId: order.id,
        type: "RETURN_REMINDER",
        recipientType: "admin",
        recipientTelegramId: String(a.telegramId),
        recipientId: a.recipientId,
        text:
          `↩️ Qaytarish so'rovi #${order.id}\n` +
          `Mijoz: ${order.user?.fullName || "—"}\n` +
          `Model: ${order.consoleType}\n` +
          `Kuryer biriktirish kerak.`,
      });
    }
    if (order.courier?.telegramId) {
      await notify({
        orderId: order.id,
        type: "RETURN_REMINDER",
        recipientType: "courier",
        recipientTelegramId: String(order.courier.telegramId),
        recipientId: order.courier.id,
        text:
          `↩️ Buyurtma #${order.id} — mijoz qaytarishga tayyor.\n` +
          `Admin kuryerni tasdiqlagach olib ketishingiz mumkin.`,
      });
    }
  } catch (err) {
    logger.warn("Return request notify failed", { error: err.message });
  }

  return updated;
}

/**
 * Admin assigns (or reassigns) courier for return pickup → RETURN_ASSIGNED.
 */
async function assignReturnCourier(orderId, courierId, adminContext = {}) {
  const order = await prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: { user: true, inventoryUnit: true },
  });
  if (!order) throw new RentalReturnError("NOT_FOUND", "Buyurtma topilmadi");

  const fromOk = [
    OrderStatus.RETURN_REQUESTED,
    OrderStatus.RETURN_ASSIGNED,
    OrderStatus.EXPIRED,
  ];
  if (!fromOk.includes(order.status)) {
    throw new RentalReturnError(
      "INVALID_STATUS",
      `Qaytarish kuryerini biriktirib bo'lmaydi: ${order.status}`
    );
  }

  const courier = await prisma.courier.findUnique({ where: { id: Number(courierId) } });
  if (!courier || !courier.isActive) {
    throw new RentalReturnError("COURIER", "Kuryer topilmadi yoki faol emas");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (order.status === OrderStatus.EXPIRED) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.RETURN_REQUESTED },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          status: OrderStatus.RETURN_REQUESTED,
          actorType: "admin",
          actorId: adminContext.adminId ?? null,
          note: "Expired → return request (admin assign)",
        },
      });
    }

    const result = await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.RETURN_ASSIGNED,
        courierId: courier.id,
        assignedAt: new Date(),
        assignedByAdmin: true,
      },
    });
    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: OrderStatus.RETURN_ASSIGNED,
        actorType: "admin",
        actorId: adminContext.adminId ?? null,
        note: `Return courier #${courier.id} (${courier.fullName || ""})`,
      },
    });
    return result;
  });

  await logRentalAudit({
    action: "RETURN_COURIER_ASSIGNED",
    orderId: order.id,
    inventoryUnitId: order.inventoryUnitId,
    actorType: "admin",
    actorId: adminContext.adminId,
    adminId: adminContext.adminId,
    telegramId: adminContext.telegramId,
    extra: { courierId: courier.id },
  });

  try {
    await notify({
      orderId: order.id,
      type: "COURIER_ASSIGNED",
      recipientType: "courier",
      recipientTelegramId: String(courier.telegramId),
      recipientId: courier.id,
      text:
        `↩️ Qaytarib olish #${order.id}\n` +
        `Manzil: ${order.address}\n` +
        `Model: ${order.consoleType}\n` +
        `Mijozdan PlayStation ni olib keling.`,
    });
  } catch (err) {
    logger.warn("Return assign notify failed", { error: err.message, stack: err.stack });
  }

  return updated;
}

/**
 * Called from completeReturn (pickup wizard): status → PICKED_UP, asset stays RENTED.
 */
async function assertPickupAllowed(order, courierId) {
  assertCourierCanPickup(order, courierId);
  // Period must have ended unless admin already forced RETURN_REQUESTED
  // (once in return flow, courier may collect)
  if (
    [OrderStatus.ACTIVE, OrderStatus.DELIVERED].includes(order.status)
  ) {
    assertRentalEnded(order);
  }
}

/**
 * Admin starts inspection after PICKED_UP.
 * InventoryUnit: RENTED → INSPECTION (UNDER_INSPECTION).
 * Order stays PICKED_UP until decision.
 */
async function startAdminInspection(orderId, { adminContext = {}, note = null } = {}) {
  const order = await prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: { inventoryUnit: true, user: true, courier: true },
  });
  if (!order) throw new RentalReturnError("NOT_FOUND", "Buyurtma topilmadi");
  if (order.status !== OrderStatus.PICKED_UP) {
    throw new RentalReturnError(
      "INVALID_STATUS",
      `Tekshiruvni boshlash faqat PICKED_UP uchun: hozir ${order.status}`
    );
  }
  if (!order.inventoryUnitId) {
    throw new RentalReturnError("NO_UNIT", "Buyurtmada inventar biriktirilmagan");
  }

  const unit = order.inventoryUnit;
  if (unit?.status === AssetStatus.INSPECTION) {
    return order;
  }
  if (unit?.status !== AssetStatus.RENTED) {
    throw new RentalReturnError(
      "INVALID_UNIT_STATUS",
      `Unit holati RENTED bo'lishi kerak: hozir ${unit?.status}`
    );
  }

  await prisma.$transaction(async (tx) => {
    await inventoryAssetService.changeStatus(order.inventoryUnitId, AssetStatus.INSPECTION, {
      tx,
      orderId: order.id,
      action: "START_INSPECTION",
      note: note || "Admin tekshiruvni boshladi",
      actorType: "admin",
      actorId: adminContext.adminId,
    });
    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: OrderStatus.PICKED_UP,
        actorType: "admin",
        actorId: adminContext.adminId ?? null,
        note: "Inspection started — unit INSPECTION",
      },
    });
  });

  await logRentalAudit({
    action: "ADMIN_INSPECTION_STARTED",
    orderId: order.id,
    inventoryUnitId: order.inventoryUnitId,
    actorType: "admin",
    actorId: adminContext.adminId,
    adminId: adminContext.adminId,
    telegramId: adminContext.telegramId,
  });

  const { DomainEvents, emitAfterCommit } = require("../events/domainBus");
  emitAfterCommit(DomainEvents.ORDER_INSPECTION_STARTED, { orderId: order.id });

  return prisma.order.findUnique({
    where: { id: order.id },
    include: { inventoryUnit: true, user: true, courier: true },
  });
}

/**
 * Admin inspection decision after PICKED_UP (and preferably after startAdminInspection).
 * ok → Inventory AVAILABLE; damaged → MAINTENANCE (UNDER_REPAIR); order → COMPLETED.
 */
async function completeAdminInspection(orderId, {
  outcome = "ok", // ok | damaged
  note = null,
  adminContext = {},
} = {}) {
  const order = await prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: {
      user: true,
      courier: true,
      inventoryUnit: true,
      playstation: true,
      orderItems: true,
    },
  });
  if (!order) throw new RentalReturnError("NOT_FOUND", "Buyurtma topilmadi");

  if (order.status !== OrderStatus.PICKED_UP && order.status !== OrderStatus.RETURNED) {
    throw new RentalReturnError(
      "INVALID_STATUS",
      `Tekshiruv faqat PICKED_UP uchun: hozir ${order.status}`
    );
  }

  const damaged = outcome === "damaged" || outcome === "maintenance";
  const targetAsset = damaged ? AssetStatus.MAINTENANCE : AssetStatus.AVAILABLE;

  const result = await prisma.$transaction(async (tx) => {
    if (order.inventoryUnitId) {
      const unit = await tx.inventoryUnit.findUnique({
        where: { id: order.inventoryUnitId },
      });
      if (unit) {
        if (unit.status === AssetStatus.RENTED) {
          await inventoryAssetService.changeStatus(unit.id, AssetStatus.INSPECTION, {
            tx,
            orderId: order.id,
            action: "INSPECTION",
            note: note || "Admin tekshiruvi",
            actorType: "admin",
            actorId: adminContext.adminId,
          });
        }
        const fresh = await tx.inventoryUnit.findUnique({ where: { id: unit.id } });
        if (fresh && fresh.status === AssetStatus.INSPECTION) {
          await inventoryAssetService.changeStatus(unit.id, targetAsset, {
            tx,
            orderId: order.id,
            action: damaged ? "MAINTENANCE" : "AVAILABLE",
            note: note || (damaged ? "Nosozlik aniqlandi" : "Tekshiruv OK"),
            actorType: "admin",
            actorId: adminContext.adminId,
          });
        } else if (fresh && [AssetStatus.AVAILABLE, AssetStatus.MAINTENANCE].includes(fresh.status)) {
          // already decided
        } else if (fresh) {
          throw new RentalReturnError(
            "INVALID_UNIT_STATUS",
            `Unit tekshiruvga tayyor emas: ${fresh.status}`
          );
        }
      }
    }

    if (order.playstationId) {
      await tx.playstation.updateMany({
        where: {
          id: order.playstationId,
          status: { in: [AssetStatus.RESERVED, AssetStatus.RENTED] },
        },
        data: { status: AssetStatus.AVAILABLE },
      });
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.COMPLETED,
        returnNote: note
          ? [order.returnNote, `Admin: ${note}`].filter(Boolean).join(" | ")
          : order.returnNote,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: OrderStatus.COMPLETED,
        actorType: "admin",
        actorId: adminContext.adminId ?? null,
        note: damaged
          ? `Admin tekshiruvi: MAINTENANCE — ${note || ""}`
          : `Admin tekshiruvi: OK — COMPLETED`,
      },
    });

    return updated;
  });

  await logRentalAudit({
    action: "ADMIN_INSPECTION_COMPLETED",
    orderId: order.id,
    inventoryUnitId: order.inventoryUnitId,
    actorType: "admin",
    actorId: adminContext.adminId,
    adminId: adminContext.adminId,
    telegramId: adminContext.telegramId,
    extra: { outcome: damaged ? "MAINTENANCE" : "AVAILABLE", note },
  });

  try {
    if (order.user?.telegramId) {
      await notify({
        orderId: order.id,
        type: "ORDER_COMPLETED",
        recipientType: "user",
        recipientTelegramId: String(order.user.telegramId),
        recipientId: order.userId,
        text: `✅ Buyurtma #${order.id} yakunlandi. Rahmat!`,
      });
    }
  } catch (err) {
    logger.warn("Inspection complete user notify failed", {
      orderId: order.id,
      error: err.message,
      stack: err.stack,
    });
  }

  const { DomainEvents, emitAfterCommit } = require("../events/domainBus");
  emitAfterCommit(DomainEvents.ORDER_INSPECTION_COMPLETED, {
    orderId: order.id,
    outcome: damaged ? "MAINTENANCE" : "AVAILABLE",
  });

  return result;
}

module.exports = {
  RentalReturnError,
  getExpectedReturnAt,
  isRentalPeriodEnded,
  assertRentalEnded,
  assertCourierCanPickup,
  assertPickupAllowed,
  computeRentalWindow,
  requestReturn,
  assignReturnCourier,
  startAdminInspection,
  completeAdminInspection,
  logRentalAudit,
  formatRemainingDuration,
};
