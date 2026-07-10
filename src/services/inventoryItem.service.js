const prisma = require("../config/prisma");
const {
  ITEM_TYPES,
  ITEM_STATUSES,
  CONDITIONS,
  labelCondition,
  labelItemType,
  labelItemStatus,
} = require("../constants/inventoryItem");

class InventoryItemError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "InventoryItemError";
    this.code = code;
  }
}

async function createItem(data, actor = {}) {
  const itemType = data.itemType;
  if (!Object.values(ITEM_TYPES).includes(itemType)) {
    throw new InventoryItemError("INVALID_TYPE", "Inventar turi noto'g'ri");
  }
  if (itemType === ITEM_TYPES.CONSOLE && !data.consoleType) {
    throw new InventoryItemError("CONSOLE_TYPE_REQUIRED", "Konsol turi majburiy");
  }
  if (!data.inventoryNumber || !data.serialNumber) {
    throw new InventoryItemError("REQUIRED", "Inventory Number va Serial Number majburiy");
  }

  const condition = data.condition || CONDITIONS.GOOD;
  if (!Object.values(CONDITIONS).includes(condition)) {
    throw new InventoryItemError("INVALID_CONDITION", "Holat noto'g'ri");
  }

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        itemType,
        consoleType: itemType === ITEM_TYPES.CONSOLE ? data.consoleType : null,
        inventoryNumber: String(data.inventoryNumber).trim().toUpperCase(),
        serialNumber: String(data.serialNumber).trim(),
        condition,
        status: ITEM_STATUSES.AVAILABLE,
        purchasedAt: data.purchasedAt ? new Date(data.purchasedAt) : null,
        note: data.note || null,
      },
    });
    await prisma.inventoryItemHistory.create({
      data: {
        inventoryItemId: item.id,
        action: "CREATED",
        toStatus: ITEM_STATUSES.AVAILABLE,
        actorType: actor.actorType || "admin",
        actorId: actor.actorId || null,
        note: data.note || null,
      },
    });
    return item;
  } catch (err) {
    if (err.code === "P2002") {
      throw new InventoryItemError("DUPLICATE", "Inventory Number yoki Serial allaqachon mavjud");
    }
    throw err;
  }
}

async function listAvailable(itemType, { consoleType, reservedOrderId } = {}) {
  const where = {
    itemType,
    OR: [
      { status: ITEM_STATUSES.AVAILABLE },
      ...(reservedOrderId
        ? [{ status: ITEM_STATUSES.RESERVED, reservedOrderId: Number(reservedOrderId) }]
        : []),
    ],
  };
  if (itemType === ITEM_TYPES.CONSOLE && consoleType) {
    where.consoleType = consoleType;
  }
  return prisma.inventoryItem.findMany({
    where,
    orderBy: { inventoryNumber: "asc" },
  });
}

async function listByType(itemType, { take = 50 } = {}) {
  return prisma.inventoryItem.findMany({
    where: itemType ? { itemType } : undefined,
    orderBy: [{ itemType: "asc" }, { inventoryNumber: "asc" }],
    take,
  });
}

async function getById(id) {
  return prisma.inventoryItem.findUnique({ where: { id: Number(id) } });
}

async function setStatus(tx, itemId, toStatus, { orderId, actorType, actorId, note, reservedOrderId } = {}) {
  const client = tx || prisma;
  const item = await client.inventoryItem.findUnique({ where: { id: Number(itemId) } });
  if (!item) throw new InventoryItemError("NOT_FOUND", "Inventar topilmadi");

  const data = { status: toStatus };
  if (toStatus === ITEM_STATUSES.RESERVED) {
    data.reservedOrderId = reservedOrderId ?? orderId ?? null;
  } else if (toStatus === ITEM_STATUSES.AVAILABLE || toStatus === ITEM_STATUSES.RENTED) {
    data.reservedOrderId = toStatus === ITEM_STATUSES.AVAILABLE ? null : item.reservedOrderId;
  }
  if (toStatus === ITEM_STATUSES.AVAILABLE) {
    data.reservedOrderId = null;
  }

  const updated = await client.inventoryItem.update({
    where: { id: item.id },
    data,
  });

  await client.inventoryItemHistory.create({
    data: {
      inventoryItemId: item.id,
      action: `STATUS_${toStatus}`,
      fromStatus: item.status,
      toStatus,
      orderId: orderId || null,
      actorType: actorType || null,
      actorId: actorId || null,
      note: note || null,
    },
  });

  return updated;
}

/**
 * Inventarni band qilish — race condition himoyasi (updateMany).
 */
async function lockItems(tx, itemIds, { orderId, actorId }) {
  const ids = [...new Set(itemIds.map(Number))];
  for (const id of ids) {
    const result = await tx.inventoryItem.updateMany({
      where: {
        id,
        OR: [
          { status: ITEM_STATUSES.AVAILABLE },
          { status: ITEM_STATUSES.RESERVED, reservedOrderId: Number(orderId) },
        ],
      },
      data: {
        status: ITEM_STATUSES.RENTED,
        reservedOrderId: Number(orderId),
      },
    });
    if (result.count !== 1) {
      throw new InventoryItemError("LOCK_FAILED", `Inventar #${id} band qilib bo'lmadi (allaqachon olingan)`);
    }
    const item = await tx.inventoryItem.findUnique({ where: { id } });
    await tx.inventoryItemHistory.create({
      data: {
        inventoryItemId: id,
        action: "RENTED",
        fromStatus: ITEM_STATUSES.AVAILABLE,
        toStatus: ITEM_STATUSES.RENTED,
        orderId: Number(orderId),
        actorType: "courier",
        actorId: actorId || null,
      },
    });
    if (!item) throw new InventoryItemError("NOT_FOUND", "Inventar topilmadi");
  }
}

async function releaseItems(tx, itemIds, { orderId, actorId, condition } = {}) {
  const client = tx || prisma;
  for (const id of itemIds) {
    const item = await client.inventoryItem.findUnique({ where: { id: Number(id) } });
    if (!item) continue;
    await client.inventoryItem.update({
      where: { id: item.id },
      data: {
        status: ITEM_STATUSES.AVAILABLE,
        reservedOrderId: null,
        ...(condition ? { condition } : {}),
      },
    });
    await client.inventoryItemHistory.create({
      data: {
        inventoryItemId: item.id,
        action: "RETURNED",
        fromStatus: item.status,
        toStatus: ITEM_STATUSES.AVAILABLE,
        orderId: orderId || null,
        actorType: "courier",
        actorId: actorId || null,
      },
    });
  }
}

function formatItemButton(item) {
  const type = labelItemType(item.itemType);
  const cond = labelCondition(item.condition);
  const st = labelItemStatus(item.status);
  return `${item.inventoryNumber} · ${cond} · ${st}`;
}

function formatItemLine(item) {
  return `${labelItemType(item.itemType)}: ${item.inventoryNumber} (SN: ${item.serialNumber})`;
}

module.exports = {
  InventoryItemError,
  createItem,
  listAvailable,
  listByType,
  getById,
  setStatus,
  lockItems,
  releaseItems,
  formatItemButton,
  formatItemLine,
  ITEM_TYPES,
  ITEM_STATUSES,
  CONDITIONS,
};
