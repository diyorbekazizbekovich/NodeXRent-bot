/**
 * Inventory Asset Manager — each InventoryUnit is a physical console asset.
 * Controllers stay thin; all lifecycle rules live here.
 */
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const auditLogService = require("./auditLog.service");
const {
  AssetStatus,
  ACTIVE_POOL_STATUSES,
  NON_DELETABLE_STATUSES,
  UNIT_OCCUPYING_ORDER_STATUSES,
  CONSOLE_TYPES,
  assertTransition,
  isAssignable,
  isNonDeletable,
} = require("../constants/inventoryAsset");
const { label: statusLabel } = require("../constants/inventoryStatus");
const { formatDate, formatDatetime } = require("../utils/dateHelper");

class InventoryAssetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "InventoryAssetError";
    this.code = code;
  }
}

function clientOf(tx) {
  return tx || prisma;
}

function toDto(unit) {
  if (!unit) return null;
  return {
    id: unit.id,
    assetCode: unit.unitCode,
    unitCode: unit.unitCode,
    model: unit.consoleType,
    consoleType: unit.consoleType,
    displayName: unit.displayName || unit.unitCode,
    serialNumber: unit.serialNumber,
    status: unit.status,
    notes: unit.adminNote,
    adminNote: unit.adminNote,
    purchasedAt: unit.purchasedAt,
    purchasePrice: unit.purchasePrice,
    lastServiceAt: unit.lastServiceAt,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

function nextUnitCode(consoleType, existingCodes) {
  let max = 0;
  const prefix = `${consoleType}-`;
  for (const code of existingCodes) {
    const num = parseInt(String(code).replace(prefix, ""), 10);
    if (Number.isFinite(num) && num > max) max = num;
  }
  return `${consoleType}-${String(max + 1).padStart(3, "0")}`;
}

async function logHistory(
  client,
  inventoryUnitId,
  { action, fromStatus, toStatus, orderId, note, actorType, actorId }
) {
  return client.inventoryUnitHistory.create({
    data: {
      inventoryUnitId,
      action,
      fromStatus: fromStatus || null,
      toStatus: toStatus || null,
      orderId: orderId != null ? Number(orderId) : null,
      note: note || null,
      actorType: actorType || null,
      actorId: actorId != null && Number.isFinite(Number(actorId)) ? Number(actorId) : null,
    },
  });
}

/**
 * Atomic status change with transition validation + history.
 */
async function changeStatus(
  inventoryUnitId,
  toStatus,
  {
    tx = null,
    orderId = null,
    note = null,
    actorType = "system",
    actorId = null,
    action = null,
    skipTransitionCheck = false,
  } = {}
) {
  const client = clientOf(tx);
  const id = Number(inventoryUnitId);
  const unit = await client.inventoryUnit.findUnique({ where: { id } });
  if (!unit) {
    throw new InventoryAssetError("NOT_FOUND", "Inventar topilmadi");
  }

  if (!skipTransitionCheck) {
    try {
      assertTransition(unit.status, toStatus);
    } catch (err) {
      throw new InventoryAssetError("INVALID_TRANSITION", err.message);
    }
  }

  if (unit.status === toStatus) {
    return unit;
  }

  const updated = await client.inventoryUnit.update({
    where: { id },
    data: { status: toStatus },
  });

  await logHistory(client, id, {
    action: action || `STATUS_${toStatus}`,
    fromStatus: unit.status,
    toStatus,
    orderId,
    note,
    actorType,
    actorId,
  });

  logger.info("Inventory asset status changed", {
    context: "InventoryAsset",
    inventoryUnitId: id,
    from: unit.status,
    to: toStatus,
    orderId,
  });

  return updated;
}

/**
 * Find AVAILABLE unit for model and lock RESERVED (race-safe via updateMany).
 * Links inventoryUnitId on the order. Never assigns the same unit twice.
 */
async function reserveForOrder(tx, { orderId, consoleType, actorType = "system", actorId = null }) {
  const client = clientOf(tx);
  const oid = Number(orderId);

  const order = await client.order.findUnique({ where: { id: oid } });
  if (!order) {
    throw new InventoryAssetError("ORDER_NOT_FOUND", "Buyurtma topilmadi");
  }
  if (order.inventoryUnitId) {
    const existing = await client.inventoryUnit.findUnique({
      where: { id: order.inventoryUnitId },
    });
    return existing;
  }

  const candidates = await client.inventoryUnit.findMany({
    where: { consoleType, status: AssetStatus.AVAILABLE },
    orderBy: { unitCode: "asc" },
    take: 50,
  });
  if (!candidates.length) return null;

  for (const unit of candidates) {
    const locked = await client.inventoryUnit.updateMany({
      where: { id: unit.id, status: AssetStatus.AVAILABLE },
      data: { status: AssetStatus.RESERVED },
    });
    if (locked.count !== 1) continue;

    try {
      await client.order.update({
        where: { id: oid },
        data: { inventoryUnitId: unit.id },
      });
    } catch (err) {
      // Unique occupying index or concurrent link — roll back reservation
      await client.inventoryUnit.updateMany({
        where: { id: unit.id, status: AssetStatus.RESERVED },
        data: { status: AssetStatus.AVAILABLE },
      });
      if (
        err?.code === "P2002" ||
        String(err?.message || "").includes("orders_unique_occupying_inventory_unit")
      ) {
        continue;
      }
      throw err;
    }

    // Double-check no other active order holds this unit
    const conflicting = await client.order.count({
      where: {
        inventoryUnitId: unit.id,
        id: { not: oid },
        status: { in: [...UNIT_OCCUPYING_ORDER_STATUSES] },
      },
    });
    if (conflicting > 0) {
      await client.order.update({
        where: { id: oid },
        data: { inventoryUnitId: null },
      });
      await client.inventoryUnit.updateMany({
        where: { id: unit.id, status: AssetStatus.RESERVED },
        data: { status: AssetStatus.AVAILABLE },
      });
      continue;
    }

    await logHistory(client, unit.id, {
      action: "RESERVED",
      fromStatus: AssetStatus.AVAILABLE,
      toStatus: AssetStatus.RESERVED,
      orderId: oid,
      note: `Order #${oid}`,
      actorType,
      actorId,
    });

    return client.inventoryUnit.findUnique({ where: { id: unit.id } });
  }

  return null;
}

/**
 * Pickup / handover: RESERVED → RENTED
 */
async function markRented(tx, inventoryUnitId, meta = {}) {
  return changeStatus(inventoryUnitId, AssetStatus.RENTED, {
    tx,
    action: "RENTED",
    ...meta,
  });
}

/**
 * Customer return: RENTED → INSPECTION
 */
async function markInspection(tx, inventoryUnitId, meta = {}) {
  return changeStatus(inventoryUnitId, AssetStatus.INSPECTION, {
    tx,
    action: "RETURNED",
    ...meta,
  });
}

/**
 * Cancel reservation: RESERVED → AVAILABLE
 */
async function releaseReservation(tx, inventoryUnitId, meta = {}) {
  return changeStatus(inventoryUnitId, AssetStatus.AVAILABLE, {
    tx,
    action: "RELEASED",
    ...meta,
  });
}

async function createAsset(data, adminContext = {}) {
  const consoleType = data.model || data.consoleType;
  if (!CONSOLE_TYPES.includes(consoleType)) {
    throw new InventoryAssetError("INVALID_MODEL", "Model PS3/PS4/PS5 bo'lishi kerak");
  }

  const serialNumber =
    data.serialNumber != null && String(data.serialNumber).trim()
      ? String(data.serialNumber).trim()
      : null;

  return prisma.$transaction(async (tx) => {
    if (serialNumber) {
      const dup = await tx.inventoryUnit.findUnique({ where: { serialNumber } });
      if (dup) {
        throw new InventoryAssetError("DUPLICATE_SERIAL", "Serial raqam allaqachon mavjud");
      }
    }

    let unitCode = data.assetCode || data.unitCode;
    if (unitCode) {
      unitCode = String(unitCode).trim().toUpperCase();
      const dupCode = await tx.inventoryUnit.findUnique({ where: { unitCode } });
      if (dupCode) {
        throw new InventoryAssetError("DUPLICATE_ASSET_CODE", "Asset code allaqachon mavjud");
      }
    } else {
      const existing = await tx.inventoryUnit.findMany({
        where: { consoleType },
        select: { unitCode: true },
      });
      unitCode = nextUnitCode(
        consoleType,
        existing.map((u) => u.unitCode)
      );
    }

    const unit = await tx.inventoryUnit.create({
      data: {
        unitCode,
        consoleType,
        displayName: data.displayName || unitCode,
        serialNumber,
        status: AssetStatus.AVAILABLE,
        adminNote: data.notes || data.adminNote || null,
        purchasedAt: data.purchasedAt ? new Date(data.purchasedAt) : null,
        purchasePrice: data.purchasePrice != null ? data.purchasePrice : null,
      },
    });

    await logHistory(tx, unit.id, {
      action: "CREATED",
      fromStatus: null,
      toStatus: AssetStatus.AVAILABLE,
      note: "Asset created",
      actorType: "admin",
      actorId: adminContext.adminId,
    });

    await auditLogService.log({
      module: "INVENTORY",
      adminId: adminContext.adminId,
      adminTelegramId: adminContext.telegramId,
      action: "INVENTORY_ASSET_CREATED",
      entityType: "InventoryUnit",
      entityId: unit.id,
      afterData: toDto(unit),
    });

    return toDto(unit);
  });
}

async function updateAsset(id, data, adminContext = {}) {
  const unitId = Number(id);
  const before = await prisma.inventoryUnit.findUnique({ where: { id: unitId } });
  if (!before) {
    throw new InventoryAssetError("NOT_FOUND", "Inventar topilmadi");
  }

  if (data.status && data.status !== before.status) {
    // Status changes go through changeStatus (validates transitions)
    await changeStatus(unitId, data.status, {
      note: data.notes || data.adminNote || data.note,
      actorType: "admin",
      actorId: adminContext.adminId,
      action: "STATUS_CHANGED",
    });
  }

  const serialNumber =
    data.serialNumber !== undefined
      ? data.serialNumber == null || String(data.serialNumber).trim() === ""
        ? null
        : String(data.serialNumber).trim()
      : undefined;

  if (serialNumber) {
    const dup = await prisma.inventoryUnit.findFirst({
      where: { serialNumber, id: { not: unitId } },
    });
    if (dup) {
      throw new InventoryAssetError("DUPLICATE_SERIAL", "Serial raqam allaqachon mavjud");
    }
  }

  if (data.assetCode || data.unitCode) {
    const code = String(data.assetCode || data.unitCode).trim().toUpperCase();
    const dup = await prisma.inventoryUnit.findFirst({
      where: { unitCode: code, id: { not: unitId } },
    });
    if (dup) {
      throw new InventoryAssetError("DUPLICATE_ASSET_CODE", "Asset code allaqachon mavjud");
    }
  }

  const patch = {};
  if (data.displayName !== undefined) patch.displayName = data.displayName;
  if (serialNumber !== undefined) patch.serialNumber = serialNumber;
  if (data.assetCode || data.unitCode) {
    patch.unitCode = String(data.assetCode || data.unitCode).trim().toUpperCase();
  }
  if (data.notes !== undefined) patch.adminNote = data.notes;
  else if (data.adminNote !== undefined) patch.adminNote = data.adminNote;
  if (data.purchasedAt !== undefined) patch.purchasedAt = new Date(data.purchasedAt);
  if (data.purchasePrice !== undefined) patch.purchasePrice = data.purchasePrice;
  if (data.lastServiceAt !== undefined) patch.lastServiceAt = new Date(data.lastServiceAt);

  const updated =
    Object.keys(patch).length > 0
      ? await prisma.inventoryUnit.update({ where: { id: unitId }, data: patch })
      : await prisma.inventoryUnit.findUnique({ where: { id: unitId } });

  await auditLogService.log({
    module: "INVENTORY",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "INVENTORY_ASSET_UPDATED",
    entityType: "InventoryUnit",
    entityId: updated.id,
    beforeData: toDto(before),
    afterData: toDto(updated),
  });

  return toDto(updated);
}

/**
 * Delete inventory unit.
 * Hard-delete allowed for AVAILABLE / MAINTENANCE / DISABLED (not in active rental).
 * Soft (default): → DISABLED when possible.
 */
async function deleteAsset(id, { hard = true, adminContext = {} } = {}) {
  const unit = await prisma.inventoryUnit.findUnique({ where: { id: Number(id) } });
  if (!unit) {
    throw new InventoryAssetError("NOT_FOUND", "Inventar topilmadi");
  }

  if (isNonDeletable(unit.status)) {
    throw new InventoryAssetError(
      "DELETE_FORBIDDEN",
      `${statusLabel(unit.status)} holatidagi qurilmani o'chirib bo'lmaydi (band/ijarada)`
    );
  }

  const hardAllowed = [
    AssetStatus.AVAILABLE,
    AssetStatus.MAINTENANCE,
    AssetStatus.DISABLED,
    AssetStatus.MISSING_PARTS,
    AssetStatus.DEFECTIVE,
    AssetStatus.LOST,
  ];

  if (hard) {
    if (!hardAllowed.includes(unit.status)) {
      throw new InventoryAssetError(
        "DELETE_FORBIDDEN",
        `Bu holatda o'chirib bo'lmaydi: ${statusLabel(unit.status)}`
      );
    }
    // Detach from historical orders (FK), then delete unit (+ history cascade)
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { inventoryUnitId: unit.id },
        data: { inventoryUnitId: null },
      });
      await tx.inventoryUnit.delete({ where: { id: unit.id } });
    });
    await auditLogService.log({
      module: "INVENTORY",
      adminId: adminContext.adminId,
      adminTelegramId: adminContext.telegramId,
      action: "INVENTORY_ASSET_DELETED",
      entityType: "InventoryUnit",
      entityId: unit.id,
      beforeData: toDto(unit),
    });
    return { deleted: true, id: unit.id, unitCode: unit.unitCode };
  }

  if (unit.status === AssetStatus.DISABLED) {
    return toDto(unit);
  }

  const updated = await changeStatus(unit.id, AssetStatus.DISABLED, {
    actorType: "admin",
    actorId: adminContext.adminId,
    action: "DISABLED",
    note: "Removed from circulation",
  });
  return toDto(updated);
}

async function getAssetDetails(id) {
  const unit = await prisma.inventoryUnit.findUnique({
    where: { id: Number(id) },
    include: {
      history: { orderBy: { createdAt: "desc" }, take: 50 },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: true },
      },
    },
  });
  if (!unit) {
    throw new InventoryAssetError("NOT_FOUND", "Inventar topilmadi");
  }

  const occupying = unit.orders.find((o) =>
    UNIT_OCCUPYING_ORDER_STATUSES.includes(o.status)
  );
  const completed = unit.orders.filter((o) =>
    ["COMPLETED", "RETURNED"].includes(o.status)
  );
  const totalRevenue = completed.reduce(
    (sum, o) => sum + Number(o.finalPaidAmount ?? o.totalPrice ?? 0),
    0
  );
  const lastRental = completed[0] || null;

  return {
    ...toDto(unit),
    currentOrder: occupying
      ? {
          id: occupying.id,
          status: occupying.status,
          startDatetime: occupying.startDatetime,
          endDatetime: occupying.endDatetime,
        }
      : null,
    currentCustomer: occupying?.user
      ? {
          id: occupying.user.id,
          fullName: occupying.user.fullName,
          phone: occupying.user.phone,
          telegramId: occupying.user.telegramId?.toString?.() || occupying.user.telegramId,
        }
      : null,
    totalRentals: completed.length,
    totalRevenue,
    lastRentalDate: lastRental?.returnedAt || lastRental?.endDatetime || null,
    history: unit.history,
  };
}

async function getAssetHistory(id, { limit = 50 } = {}) {
  const unit = await prisma.inventoryUnit.findUnique({
    where: { id: Number(id) },
    select: { id: true },
  });
  if (!unit) {
    throw new InventoryAssetError("NOT_FOUND", "Inventar topilmadi");
  }
  return prisma.inventoryUnitHistory.findMany({
    where: { inventoryUnitId: unit.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, Number(limit) || 50)),
  });
}

function buildStatusCounts(rows) {
  const counts = {
    total: 0,
    available: 0,
    reserved: 0,
    rented: 0,
    inspection: 0,
    maintenance: 0,
    disabled: 0,
    lost: 0,
  };
  const keyMap = {
    AVAILABLE: "available",
    RESERVED: "reserved",
    RENTED: "rented",
    INSPECTION: "inspection",
    MAINTENANCE: "maintenance",
    DISABLED: "disabled",
    LOST: "lost",
    MISSING_PARTS: "maintenance",
    DEFECTIVE: "disabled",
  };
  for (const row of rows) {
    const n = row._count?._all ?? row._count ?? 0;
    counts.total += n;
    const k = keyMap[row.status];
    if (k) counts[k] += n;
  }
  return counts;
}

/**
 * Dynamic per-model statistics (never stored manually).
 */
async function getStatistics({ model } = {}) {
  const types = model ? [model] : [...CONSOLE_TYPES];
  const result = {};

  for (const consoleType of types) {
    const grouped = await prisma.inventoryUnit.groupBy({
      by: ["status"],
      where: { consoleType },
      _count: { _all: true },
    });
    const counts = buildStatusCounts(grouped.map((g) => ({ status: g.status, _count: g._count })));

    const occupancyRate =
      counts.total > 0
        ? Math.round(((counts.reserved + counts.rented) / counts.total) * 10000) / 100
        : 0;

    const completedOrders = await prisma.order.findMany({
      where: {
        consoleType,
        status: { in: ["COMPLETED", "RETURNED"] },
        inventoryUnitId: { not: null },
      },
      select: { finalPaidAmount: true, totalPrice: true },
    });

    const revenue = completedOrders.reduce(
      (sum, o) => sum + Number(o.finalPaidAmount ?? o.totalPrice ?? 0),
      0
    );

    result[consoleType] = {
      model: consoleType,
      totalUnits: counts.total,
      available: counts.available,
      reserved: counts.reserved,
      rented: counts.rented,
      inspection: counts.inspection,
      maintenance: counts.maintenance,
      disabled: counts.disabled,
      lost: counts.lost,
      occupancyRate,
      completedRentals: completedOrders.length,
      revenue,
      // Backward-compatible aliases used by Telegram admin UI
      total: counts.total,
    };
  }

  return model ? result[model] : result;
}

/**
 * List / filter / search / sort assets.
 */
async function listAssets({
  model,
  consoleType,
  status,
  search,
  sort = "newest",
  page = 1,
  limit = 50,
} = {}) {
  const where = {};
  const type = model || consoleType;
  if (type) where.consoleType = type;
  if (status) where.status = status;
  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [
      { unitCode: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const take = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  let orderBy = { createdAt: "desc" };
  if (sort === "oldest") orderBy = { createdAt: "asc" };
  if (sort === "assetCode" || sort === "unitCode") orderBy = { unitCode: "asc" };

  // mostRented / highestRevenue need aggregation — fetch then sort in memory for page window
  if (sort === "mostRented" || sort === "highestRevenue") {
    const units = await prisma.inventoryUnit.findMany({
      where,
      include: {
        orders: {
          where: { status: { in: ["COMPLETED", "RETURNED"] } },
          select: { finalPaidAmount: true, totalPrice: true },
        },
      },
    });
    const enriched = units.map((u) => {
      const rentals = u.orders.length;
      const revenue = u.orders.reduce(
        (s, o) => s + Number(o.finalPaidAmount ?? o.totalPrice ?? 0),
        0
      );
      return { ...toDto(u), totalRentals: rentals, totalRevenue: revenue };
    });
    enriched.sort((a, b) =>
      sort === "mostRented"
        ? b.totalRentals - a.totalRentals
        : b.totalRevenue - a.totalRevenue
    );
    const total = enriched.length;
    return {
      total,
      page: Number(page) || 1,
      limit: take,
      items: enriched.slice(skip, skip + take),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.inventoryUnit.count({ where }),
    prisma.inventoryUnit.findMany({ where, orderBy, skip, take }),
  ]);

  return {
    total,
    page: Number(page) || 1,
    limit: take,
    items: rows.map(toDto),
  };
}

async function listAvailable({ model, consoleType } = {}) {
  const type = model || consoleType;
  const where = { status: AssetStatus.AVAILABLE };
  if (type) where.consoleType = type;
  const rows = await prisma.inventoryUnit.findMany({
    where,
    orderBy: { unitCode: "asc" },
  });
  return rows.map(toDto);
}

/**
 * Sync unit from order lifecycle (used by DeviceStatus manager).
 * Maps order targets onto allowed asset transitions.
 */
async function syncFromOrderTarget(client, order, target, meta = {}) {
  if (!order?.inventoryUnitId || !target) return { synced: false };

  const unit = await client.inventoryUnit.findUnique({
    where: { id: order.inventoryUnitId },
  });
  if (!unit) return { synced: false };
  if (unit.status === target) return { synced: false, current: unit.status };

  // Map legacy/order targets onto legal asset transitions
  let toStatus = target;
  if (target === AssetStatus.AVAILABLE) {
    if (unit.status === AssetStatus.RESERVED) {
      toStatus = AssetStatus.AVAILABLE; // cancel reservation
    } else if (unit.status === AssetStatus.RENTED) {
      // Order "release to available" on return must become INSPECTION
      toStatus = AssetStatus.INSPECTION;
    } else if (
      [AssetStatus.INSPECTION, AssetStatus.MAINTENANCE, AssetStatus.DISABLED].includes(
        unit.status
      )
    ) {
      return { synced: false, current: unit.status };
    } else {
      return { synced: false, current: unit.status };
    }
  } else if (target === AssetStatus.INSPECTION) {
    if (unit.status !== AssetStatus.RENTED) {
      return { synced: false, current: unit.status };
    }
  } else if (target === AssetStatus.RENTED) {
    if (![AssetStatus.RESERVED, AssetStatus.RENTED].includes(unit.status)) {
      // Late assign path may still be AVAILABLE — reserve then rent
      if (unit.status === AssetStatus.AVAILABLE) {
        await changeStatus(unit.id, AssetStatus.RESERVED, {
          tx: client,
          orderId: order.id,
          action: "RESERVED",
          ...meta,
        });
      } else {
        return { synced: false, current: unit.status };
      }
    }
  } else if (target === AssetStatus.RESERVED) {
    if (![AssetStatus.AVAILABLE, AssetStatus.RESERVED].includes(unit.status)) {
      return { synced: false, current: unit.status };
    }
  }

  try {
    await changeStatus(unit.id, toStatus, {
      tx: client,
      orderId: order.id,
      action: `SYNC_${toStatus}`,
      note: meta.reason || `order:${order.id}`,
      actorType: meta.actorType || "system",
      actorId: meta.actorId,
    });
    return { synced: true, target: toStatus };
  } catch (err) {
    if (err instanceof InventoryAssetError && err.code === "INVALID_TRANSITION") {
      logger.warn("Inventory sync skipped — invalid transition", {
        context: "InventoryAsset",
        unitId: unit.id,
        from: unit.status,
        to: toStatus,
        orderId: order.id,
      });
      return { synced: false, current: unit.status, error: err.message };
    }
    throw err;
  }
}

function formatAssetDetailHtml(details) {
  if (!details) return "Qurilma topilmadi.";
  const { escapeHtml } = require("../utils/telegramFormat");
  const lines = [
    `🏷 <b>${escapeHtml(details.assetCode)}</b>`,
    details.displayName && details.displayName !== details.assetCode
      ? `Nomi: ${escapeHtml(details.displayName)}`
      : "",
    `Model: ${escapeHtml(details.model)}`,
    details.serialNumber ? `Serial: ${escapeHtml(details.serialNumber)}` : "Serial: —",
    `Holat: ${escapeHtml(statusLabel(details.status))}`,
    details.currentOrder
      ? `Joriy buyurtma: #${details.currentOrder.id} (${escapeHtml(details.currentOrder.status)})`
      : "Joriy buyurtma: —",
    details.currentCustomer
      ? `Mijoz: ${escapeHtml(details.currentCustomer.fullName || "—")} ${escapeHtml(details.currentCustomer.phone || "")}`
      : "Mijoz: —",
    `Jami ijara: ${details.totalRentals}`,
    `Daromad: ${Number(details.totalRevenue || 0).toLocaleString()} so'm`,
    `Oxirgi ijara: ${details.lastRentalDate ? escapeHtml(formatDatetime(details.lastRentalDate)) : "—"}`,
    `Yaratilgan: ${escapeHtml(formatDate(details.createdAt))}`,
    details.notes ? `Izoh: ${escapeHtml(details.notes)}` : "",
    "",
    "<b>Tarix:</b>",
  ];
  if (!details.history?.length) lines.push("Tarix bo'sh.");
  else {
    for (const h of details.history.slice(0, 20)) {
      lines.push(
        `• ${escapeHtml(h.action)} ${
          h.fromStatus ? escapeHtml(statusLabel(h.fromStatus)) + " → " : ""
        }${h.toStatus ? escapeHtml(statusLabel(h.toStatus)) : ""} (${escapeHtml(formatDatetime(h.createdAt))})`
      );
    }
  }
  return lines.filter((l) => l !== "").join("\n");
}

module.exports = {
  InventoryAssetError,
  AssetStatus,
  toDto,
  nextUnitCode,
  logHistory,
  changeStatus,
  reserveForOrder,
  markRented,
  markInspection,
  releaseReservation,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetDetails,
  getAssetHistory,
  getStatistics,
  listAssets,
  listAvailable,
  syncFromOrderTarget,
  formatAssetDetailHtml,
  NON_DELETABLE_STATUSES,
  ACTIVE_POOL_STATUSES,
  isAssignable,
};
