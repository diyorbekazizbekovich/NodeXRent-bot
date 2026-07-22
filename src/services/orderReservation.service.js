/**
 * Order ↔ InventoryUnit binding.
 *
 * NEW lifecycle (serial-based):
 *   Order create / admin confirm → inventoryUnitId NULL
 *   Courier handover → pick AVAILABLE by serial → bind + RENTED
 *   Return → INSPECTION → admin → AVAILABLE | MAINTENANCE (REPAIR)
 *
 * Legacy: some in-flight orders may already have RESERVED unit from old confirm flow.
 */
const prisma = require("../config/prisma");
const inventoryAssetService = require("./inventoryAsset.service");
const { InventoryAssetError } = require("./inventoryAsset.service");
const { AssetStatus, UNIT_OCCUPYING_ORDER_STATUSES } = require("../constants/inventoryAsset");
const { OrderAssignmentError } = require("../errors/order.errors");
const orderRepository = require("../repositories/order.repository");

/**
 * @deprecated Prefer bindUnitAtHandover. Kept for emergency admin tooling / legacy heal.
 */
async function reserveUnitForOrder(
  tx,
  { orderId, consoleType, actorType = "admin", actorId = null, unitId = null }
) {
  const client = tx || prisma;
  const oid = Number(orderId);

  const order = await client.order.findUnique({
    where: { id: oid },
    select: { id: true, inventoryUnitId: true, consoleType: true, status: true },
  });
  if (!order) {
    throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  }

  if (order.inventoryUnitId) {
    return client.inventoryUnit.findUnique({ where: { id: order.inventoryUnitId } });
  }

  if (unitId) {
    const locked = await client.inventoryUnit.updateMany({
      where: {
        id: Number(unitId),
        consoleType: consoleType || order.consoleType,
        status: AssetStatus.AVAILABLE,
      },
      data: { status: AssetStatus.RESERVED },
    });
    if (locked.count !== 1) {
      throw new OrderAssignmentError(
        "NO_INVENTORY",
        "Tanlangan qurilma AVAILABLE emas yoki boshqa buyurtmaga band"
      );
    }
    try {
      await client.order.update({
        where: { id: oid },
        data: { inventoryUnitId: Number(unitId) },
      });
    } catch (_) {
      await client.inventoryUnit.updateMany({
        where: { id: Number(unitId), status: AssetStatus.RESERVED },
        data: { status: AssetStatus.AVAILABLE },
      });
      throw new OrderAssignmentError(
        "NO_INVENTORY",
        "Qurilmani buyurtmaga biriktirib bo'lmadi (band yoki race)"
      );
    }
    await inventoryAssetService.logHistory(client, Number(unitId), {
      action: "RESERVED",
      fromStatus: AssetStatus.AVAILABLE,
      toStatus: AssetStatus.RESERVED,
      orderId: oid,
      note: `Order #${oid} (legacy reserve)`,
      actorType,
      actorId,
    });
    return client.inventoryUnit.findUnique({ where: { id: Number(unitId) } });
  }

  try {
    return await inventoryAssetService.reserveForOrder(client, {
      orderId: oid,
      consoleType: consoleType || order.consoleType,
      actorType,
      actorId,
    });
  } catch (err) {
    if (err instanceof InventoryAssetError) {
      throw new OrderAssignmentError(err.code || "NO_INVENTORY", err.message);
    }
    throw err;
  }
}

/**
 * Handover: race-safe bind AVAILABLE unit → RENTED + Order.inventoryUnitId.
 * Also supports legacy RESERVED unit already on the order.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function bindUnitAtHandover(
  tx,
  { orderId, unitId, actorType = "courier", actorId = null }
) {
  const oid = Number(orderId);
  const uid = Number(unitId);

  const order = await tx.order.findUnique({
    where: { id: oid },
    include: { inventoryUnit: true },
  });
  if (!order) {
    throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  }

  // Already bound to this unit
  if (order.inventoryUnitId && Number(order.inventoryUnitId) === uid) {
    const unit = order.inventoryUnit;
    if (unit.status === AssetStatus.RENTED) return unit;
    if (unit.status === AssetStatus.RESERVED) {
      await inventoryAssetService.changeStatus(uid, AssetStatus.RENTED, {
        tx,
        orderId: oid,
        action: "RENTED",
        note: `Handover legacy RESERVED → RENTED #${oid}`,
        actorType,
        actorId,
      });
      return tx.inventoryUnit.findUnique({ where: { id: uid } });
    }
    throw new OrderAssignmentError(
      "INVALID_UNIT",
      `Biriktirilgan qurilma holati noto'g'ri: ${unit.status}`
    );
  }

  if (order.inventoryUnitId && Number(order.inventoryUnitId) !== uid) {
    throw new OrderAssignmentError(
      "ALREADY_BOUND",
      "Buyurtmaga boshqa qurilma allaqachon biriktirilgan"
    );
  }

  const occupied = await isUnitOccupiedByOtherOrder(tx, uid, oid);
  if (occupied) {
    throw new OrderAssignmentError(
      "NO_INVENTORY",
      "Bu qurilma boshqa faol buyurtmada band"
    );
  }

  const unit = await tx.inventoryUnit.findUnique({ where: { id: uid } });
  if (!unit) {
    throw new OrderAssignmentError("NO_INVENTORY", "Qurilma topilmadi");
  }
  if (unit.consoleType !== order.consoleType) {
    throw new OrderAssignmentError(
      "CONSOLE_TYPE",
      `Qurilma turi mos emas: ${unit.consoleType} ≠ ${order.consoleType}`
    );
  }

  // Race-safe: only one courier wins AVAILABLE → RENTED
  const locked = await tx.inventoryUnit.updateMany({
    where: { id: uid, status: AssetStatus.AVAILABLE },
    data: { status: AssetStatus.RENTED },
  });
  if (locked.count !== 1) {
    throw new OrderAssignmentError(
      "NO_INVENTORY",
      "Qurilma AVAILABLE emas yoki boshqa kuryer tomonidan band qilindi. Qayta tanlang."
    );
  }

  try {
    await tx.order.update({
      where: { id: oid },
      data: { inventoryUnitId: uid },
    });
  } catch (err) {
    await tx.inventoryUnit.updateMany({
      where: { id: uid, status: AssetStatus.RENTED },
      data: { status: AssetStatus.AVAILABLE },
    });
    throw new OrderAssignmentError(
      "NO_INVENTORY",
      "Qurilmani buyurtmaga biriktirib bo'lmadi (race). Qayta urinib ko'ring."
    );
  }

  await inventoryAssetService.logHistory(tx, uid, {
    action: "RENTED",
    fromStatus: AssetStatus.AVAILABLE,
    toStatus: AssetStatus.RENTED,
    orderId: oid,
    note: `Handover bind #${oid} serial=${unit.serialNumber || "—"}`,
    actorType,
    actorId,
  });

  return tx.inventoryUnit.findUnique({ where: { id: uid } });
}

/**
 * Legacy helper: load unit if already bound (RESERVED/RENTED).
 * New orders have null until handover — callers must not require this at accept.
 */
async function getReservedUnitForOrder(tx, orderId) {
  const client = tx || prisma;
  const order = await client.order.findUnique({
    where: { id: Number(orderId) },
    include: { inventoryUnit: true },
  });
  if (!order) {
    throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");
  }
  if (!order.inventoryUnitId || !order.inventoryUnit) {
    return null;
  }
  return order.inventoryUnit;
}

/**
 * Admin confirm: PENDING → ADMIN_CONFIRMED. Does NOT bind InventoryUnit.
 */
async function confirmOrderWithReservation(orderId, adminTelegramId, { unitId = null } = {}) {
  const orderConfirmationService = require("./orderConfirmation.service");
  const { OrderStatus } = require("../constants/orderStatus");

  // unitId ignored — binding happens at courier handover by serial
  void unitId;

  const confirmedId = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: Number(orderId) } });
    if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");

    orderConfirmationService.assertCanConfirmOrder(order);

    if (order.status !== OrderStatus.PENDING) {
      throw new OrderAssignmentError(
        "NOT_AVAILABLE",
        `Faqat PENDING buyurtmani tasdiqlash mumkin (hozir: ${order.status})`
      );
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.ADMIN_CONFIRMED,
        confirmedAt: new Date(),
        isHighPriority: false,
        // Explicit: do not bind unit at confirm
        inventoryUnitId: null,
      },
    });

    await orderRepository.createStatusLog(
      order.id,
      OrderStatus.ADMIN_CONFIRMED,
      {
        actorType: "admin",
        actorId: adminTelegramId,
        note: "Admin tasdiqladi — PlayStation topshirishda Serial Number bo'yicha tanlanadi",
      },
      tx
    );

    return order.id;
  });

  return orderRepository.findById(confirmedId);
}

async function isUnitOccupiedByOtherOrder(tx, unitId, excludeOrderId) {
  const client = tx || prisma;
  const n = await client.order.count({
    where: {
      inventoryUnitId: Number(unitId),
      id: { not: Number(excludeOrderId) },
      status: { in: [...UNIT_OCCUPYING_ORDER_STATUSES] },
    },
  });
  return n > 0;
}

/**
 * List AVAILABLE units for handover pick (model + serial).
 */
async function listAvailableUnitsForHandover(consoleType) {
  return prisma.inventoryUnit.findMany({
    where: {
      consoleType,
      status: AssetStatus.AVAILABLE,
    },
    orderBy: { unitCode: "asc" },
  });
}

module.exports = {
  reserveUnitForOrder,
  bindUnitAtHandover,
  getReservedUnitForOrder,
  confirmOrderWithReservation,
  isUnitOccupiedByOtherOrder,
  listAvailableUnitsForHandover,
};
