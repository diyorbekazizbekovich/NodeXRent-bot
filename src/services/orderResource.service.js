const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const inventoryItemService = require("./inventoryItem.service");
const deviceStatusService = require("./deviceStatus.service");

/**
 * Collect all inventory item IDs linked to an order (join table + legacy FKs).
 */
function collectItemIds(order) {
  const ids = new Set();
  for (const link of order.orderItems || []) {
    if (link.inventoryItemId) ids.add(Number(link.inventoryItemId));
  }
  for (const key of ["consoleItemId", "hdmiItemId", "powerItemId"]) {
    if (order[key] != null) ids.add(Number(order[key]));
  }
  return [...ids];
}

function safeActorId(actorId) {
  if (actorId == null) return null;
  const n = Number(actorId);
  if (!Number.isFinite(n) || Math.abs(n) > 2147483647) return null;
  return n;
}

/**
 * Release PlayStation + InventoryUnit + InventoryItems for an order.
 * Device release goes through Device Status Manager (RESERVED|RENTED → AVAILABLE).
 * Must run inside the same DB transaction as the status change when terminating.
 */
async function releaseOrderResources(
  tx,
  order,
  { actorType = "system", actorId = null, reason = "ORDER_TERMINATED", releaseItems = true, itemCondition } = {}
) {
  const client = tx || prisma;
  const orderId = order.id;
  const released = { playstation: false, inventoryUnit: false, inventoryItems: 0 };

  if (order.playstationId || order.inventoryUnitId) {
    const sync = await deviceStatusService.syncDeviceToOrderStatus(client, order, "CANCELLED", {
      actorType,
      actorId,
      reason,
    });
    released.playstation = Boolean(sync?.synced || order.playstationId);
    released.inventoryUnit = Boolean(order.inventoryUnitId);
  }

  if (releaseItems) {
    const itemIds = collectItemIds(order);
    if (itemIds.length) {
      await inventoryItemService.releaseItems(client, itemIds, {
        orderId,
        actorId: safeActorId(actorId),
        condition: itemCondition,
      });
      released.inventoryItems = itemIds.length;
    }
  }

  logger.info("Order resources released", {
    context: "OrderResource",
    orderId,
    reason,
    ...released,
  });

  return released;
}

/** Minimal include for release helpers */
const RELEASE_INCLUDE = {
  orderItems: { select: { inventoryItemId: true } },
};

async function loadOrderForRelease(tx, orderId) {
  const client = tx || prisma;
  return client.order.findUnique({
    where: { id: Number(orderId) },
    include: RELEASE_INCLUDE,
  });
}

module.exports = {
  collectItemIds,
  releaseOrderResources,
  loadOrderForRelease,
  RELEASE_INCLUDE,
};
