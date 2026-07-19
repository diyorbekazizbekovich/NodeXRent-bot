/**
 * Order ↔ InventoryUnit reservation — single source of truth.
 *
 * Lifecycle (asset):
 *   AVAILABLE → (admin approve) → RESERVED → (handover) → RENTED → … → AVAILABLE
 *
 * Rules:
 * - Admin confirm MUST bind a concrete InventoryUnit to Order.inventoryUnitId
 * - Courier accept NEVER searches "first AVAILABLE" — uses the reserved unit
 * - Race-safe via updateMany (AVAILABLE → RESERVED) + unique occupying index
 */
const prisma = require("../config/prisma");
const inventoryAssetService = require("./inventoryAsset.service");
const { InventoryAssetError } = require("./inventoryAsset.service");
const { AssetStatus, UNIT_OCCUPYING_ORDER_STATUSES } = require("../constants/inventoryAsset");
const { OrderAssignmentError } = require("../errors/order.errors");
const orderRepository = require("../repositories/order.repository");

/**
 * Reserve an AVAILABLE InventoryUnit for the order inside an existing transaction.
 * Idempotent if order already has inventoryUnitId.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ orderId: number, consoleType: string, actorType?: string, actorId?: number|null, unitId?: number|null }} opts
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
    const existing = await client.inventoryUnit.findUnique({
      where: { id: order.inventoryUnitId },
    });
    if (!existing) {
      throw new OrderAssignmentError(
        "NO_INVENTORY",
        "Buyurtmadagi inventar qurilmasi topilmadi"
      );
    }
    if (
      existing.status !== AssetStatus.RESERVED &&
      existing.status !== AssetStatus.RENTED
    ) {
      // Heal: ensure reserved link matches status for active reservation
      if (existing.status === AssetStatus.AVAILABLE) {
        const locked = await client.inventoryUnit.updateMany({
          where: { id: existing.id, status: AssetStatus.AVAILABLE },
          data: { status: AssetStatus.RESERVED },
        });
        if (locked.count === 1) {
          await inventoryAssetService.logHistory(client, existing.id, {
            action: "RESERVED",
            fromStatus: AssetStatus.AVAILABLE,
            toStatus: AssetStatus.RESERVED,
            orderId: oid,
            note: `Re-lock for order #${oid}`,
            actorType,
            actorId,
          });
          return client.inventoryUnit.findUnique({ where: { id: existing.id } });
        }
      }
    }
    return existing;
  }

  // Explicit unit (admin picked) or first AVAILABLE for model
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
    } catch (err) {
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
      note: `Order #${oid} (explicit)`,
      actorType,
      actorId,
    });
    return client.inventoryUnit.findUnique({ where: { id: Number(unitId) } });
  }

  let unit;
  try {
    unit = await inventoryAssetService.reserveForOrder(client, {
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

  if (!unit) {
    throw new OrderAssignmentError(
      "NO_INVENTORY",
      `Bo'sh ${consoleType || order.consoleType} inventar yo'q (AVAILABLE). ` +
        `Admin Inventar bo'limidan qurilma qo'shing yoki ta'mirdan chiqaring.`
    );
  }

  return unit;
}

/**
 * Courier path: load the unit already bound to the order. Never search AVAILABLE.
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
    throw new OrderAssignmentError(
      "NO_RESERVATION",
      "Buyurtmaga inventar biriktirilmagan. Admin qayta tasdiqlashi kerak."
    );
  }
  const unit = order.inventoryUnit;
  if (unit.status !== AssetStatus.RESERVED && unit.status !== AssetStatus.RENTED) {
    throw new OrderAssignmentError(
      "NO_RESERVATION",
      `Biriktirilgan qurilma (${unit.unitCode}) RESERVED emas (hozir: ${unit.status}). ` +
        `Admin qayta tasdiqlashi kerak.`
    );
  }
  return unit;
}

/**
 * Admin confirm: PENDING → ADMIN_CONFIRMED + reserve InventoryUnit (one transaction).
 */
async function confirmOrderWithReservation(orderId, adminTelegramId, { unitId = null } = {}) {
  const orderConfirmationService = require("./orderConfirmation.service");
  const { OrderStatus } = require("../constants/orderStatus");

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

    const unit = await reserveUnitForOrder(tx, {
      orderId: order.id,
      consoleType: order.consoleType,
      actorType: "admin",
      actorId: null, // telegram id may exceed Int32
      unitId,
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.ADMIN_CONFIRMED,
        confirmedAt: new Date(),
        isHighPriority: false,
        inventoryUnitId: unit.id,
      },
    });

    await orderRepository.createStatusLog(
      order.id,
      OrderStatus.ADMIN_CONFIRMED,
      {
        actorType: "admin",
        actorId: adminTelegramId,
        note: `Admin tasdiqladi — ${unit.unitCode} RESERVED`,
      },
      tx
    );

    return order.id;
  });

  return orderRepository.findById(confirmedId);
}

/**
 * True if another non-terminal order already holds this unit.
 */
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

module.exports = {
  reserveUnitForOrder,
  getReservedUnitForOrder,
  confirmOrderWithReservation,
  isUnitOccupiedByOtherOrder,
};
