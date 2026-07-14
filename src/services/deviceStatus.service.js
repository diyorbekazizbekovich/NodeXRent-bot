/**
 * Device Status Manager — sole entry point for PlayStation status changes
 * tied to orders. InventoryUnit asset sync delegates to inventoryAsset.service.
 */
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const {
  DeviceStatus,
  ASSIGNABLE_DEVICE_STATUSES,
  OCCUPYING_DEVICE_STATUSES,
  DEVICE_OCCUPYING_ORDER_STATUSES,
  expectedPlaystationStatus,
  expectedInventoryUnitStatus,
  isAssignable,
} = require("../constants/deviceStatus");

class DeviceStatusError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeviceStatusError";
    this.code = code;
  }
}

function clientOf(tx) {
  return tx || prisma;
}

/**
 * Atomic claim: AVAILABLE → RESERVED (row-level via updateMany).
 * @returns {Promise<{ playstationId: number }>}
 */
async function claimPlaystation(tx, playstationId, { orderId, reason = "CLAIM" } = {}) {
  const client = clientOf(tx);
  const id = Number(playstationId);
  if (!Number.isFinite(id)) {
    throw new DeviceStatusError("INVALID_DEVICE", "PlayStation id noto'g'ri");
  }

  const result = await client.playstation.updateMany({
    where: { id, status: DeviceStatus.AVAILABLE },
    data: { status: DeviceStatus.RESERVED },
  });

  if (result.count !== 1) {
    throw new DeviceStatusError(
      "DEVICE_NOT_AVAILABLE",
      "PlayStation band yoki ta'mirda — boshqa qurilmani tanlang"
    );
  }

  logger.info("Device claimed (RESERVED)", {
    context: "DeviceStatus",
    playstationId: id,
    orderId,
    reason,
  });

  return { playstationId: id };
}

/**
 * Sync PlayStation (+ optional InventoryUnit) to match order status.
 * Never frees device on EXPIRED — stays RENTED.
 */
async function syncDeviceToOrderStatus(tx, order, orderStatus, { actorType, actorId, reason } = {}) {
  const client = clientOf(tx);
  const psTarget = expectedPlaystationStatus(orderStatus);
  const unitTarget = expectedInventoryUnitStatus(orderStatus);

  if (order?.playstationId && psTarget) {
    const ps = await client.playstation.findUnique({ where: { id: order.playstationId } });
    if (ps) {
      const blockedOps = [
        DeviceStatus.MAINTENANCE,
        DeviceStatus.MISSING_PARTS,
        DeviceStatus.DEFECTIVE,
        DeviceStatus.DISABLED,
        DeviceStatus.LOST,
        DeviceStatus.INSPECTION,
      ];
      if (blockedOps.includes(ps.status) && psTarget !== DeviceStatus.AVAILABLE) {
        logger.warn("Device in ops status — skip rental sync", {
          context: "DeviceStatus",
          playstationId: ps.id,
          current: ps.status,
          target: psTarget,
          orderId: order.id,
        });
      } else if (ps.status !== psTarget) {
        if (psTarget === DeviceStatus.AVAILABLE) {
          await client.playstation.updateMany({
            where: {
              id: ps.id,
              status: { in: [...OCCUPYING_DEVICE_STATUSES] },
            },
            data: { status: DeviceStatus.AVAILABLE },
          });
          logger.info("Device released to AVAILABLE", {
            context: "DeviceStatus",
            playstationId: ps.id,
            orderId: order.id,
            orderStatus,
            reason: reason || orderStatus,
          });
        } else if (psTarget === DeviceStatus.RENTED) {
          await client.playstation.updateMany({
            where: {
              id: ps.id,
              status: { in: [DeviceStatus.RESERVED, DeviceStatus.RENTED] },
            },
            data: { status: DeviceStatus.RENTED },
          });
          logger.info("Device synced to RENTED", {
            context: "DeviceStatus",
            playstationId: ps.id,
            orderId: order.id,
            orderStatus,
          });
        } else if (psTarget === DeviceStatus.RESERVED) {
          await client.playstation.updateMany({
            where: {
              id: ps.id,
              status: { in: [DeviceStatus.AVAILABLE, DeviceStatus.RESERVED] },
            },
            data: { status: DeviceStatus.RESERVED },
          });
          logger.info("Device synced to RESERVED", {
            context: "DeviceStatus",
            playstationId: ps.id,
            orderId: order.id,
            orderStatus,
          });
        }
      }
    }
  }

  if (order?.inventoryUnitId && unitTarget) {
    const inventoryAssetService = require("./inventoryAsset.service");
    await inventoryAssetService.syncFromOrderTarget(client, order, unitTarget, {
      actorType,
      actorId,
      reason,
    });
  }

  return { synced: true, target: psTarget || unitTarget };
}

/**
 * Release device for terminal cancel (AVAILABLE).
 */
async function releaseDevice(tx, order, meta = {}) {
  return syncDeviceToOrderStatus(tx, order, "CANCELLED", {
    ...meta,
    reason: meta.reason || "RELEASE",
  });
}

/**
 * List only truly assignable playstations (AVAILABLE + not on occupying orders).
 */
async function listAssignablePlaystations({ consoleType, startDatetime, endDatetime, courierId } = {}) {
  const where = {
    status: DeviceStatus.AVAILABLE,
    courier: { isActive: true },
  };
  if (consoleType) where.type = consoleType;
  if (courierId) where.courierId = Number(courierId);

  const candidates = await prisma.playstation.findMany({
    where,
    include: { courier: true },
  });

  const busyOrders = await prisma.order.findMany({
    where: {
      status: { in: [...DEVICE_OCCUPYING_ORDER_STATUSES] },
      playstationId: { not: null },
      ...(startDatetime && endDatetime
        ? {
            AND: [
              { startDatetime: { lte: endDatetime } },
              { endDatetime: { gte: startDatetime } },
            ],
          }
        : {}),
    },
    select: { playstationId: true },
  });
  const busyIds = new Set(busyOrders.map((o) => o.playstationId).filter(Boolean));

  return candidates.filter((ps) => !busyIds.has(ps.id) && isAssignable(ps.status));
}

async function findAssignableForCourier(courierId, consoleType, startDatetime, endDatetime) {
  const list = await listAssignablePlaystations({
    consoleType,
    startDatetime,
    endDatetime,
    courierId,
  });
  return list[0] || null;
}

/**
 * Set ops status (MAINTENANCE etc.) — never from order lifecycle.
 */
async function setOpsStatus(playstationId, status, { reason } = {}) {
  if (ASSIGNABLE_DEVICE_STATUSES.includes(status) || OCCUPYING_DEVICE_STATUSES.includes(status)) {
    throw new DeviceStatusError("INVALID_OPS_STATUS", "Use claim/sync/release for rental statuses");
  }
  const updated = await prisma.playstation.update({
    where: { id: Number(playstationId) },
    data: { status },
  });
  logger.info("Device ops status set", {
    context: "DeviceStatus",
    playstationId,
    status,
    reason,
  });
  return updated;
}

module.exports = {
  DeviceStatusError,
  claimPlaystation,
  syncDeviceToOrderStatus,
  releaseDevice,
  listAssignablePlaystations,
  findAssignableForCourier,
  setOpsStatus,
  ASSIGNABLE_DEVICE_STATUSES,
  DeviceStatus,
};
