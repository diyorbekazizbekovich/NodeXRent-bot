/**
 * Inventory facade — keeps existing Telegram/admin APIs stable while
 * asset lifecycle lives in inventoryAsset.service.
 */
const prisma = require("../config/prisma");
const auditLogService = require("./auditLog.service");
const inventoryAssetService = require("./inventoryAsset.service");
const { AssetStatus, NON_DELETABLE_STATUSES } = require("../constants/inventoryAsset");
const { label: statusLabel } = require("../constants/inventoryStatus");
const { formatDate, formatDatetime } = require("../utils/dateHelper");

function buildCountsFromGrouped(grouped) {
  const types = ["PS3", "PS4", "PS5"];
  const result = {};
  for (const t of types) {
    result[t] = {
      total: 0,
      rented: 0,
      available: 0,
      reserved: 0,
      inspection: 0,
      maintenance: 0,
      disabled: 0,
      lost: 0,
    };
  }
  for (const row of grouped) {
    const t = row.consoleType;
    if (!result[t]) continue;
    result[t].total += row._count._all;
    if (row.status === "RENTED") result[t].rented += row._count._all;
    if (row.status === "RESERVED") {
      result[t].reserved += row._count._all;
      result[t].rented += row._count._all; // legacy "band" bucket
    }
    if (row.status === "AVAILABLE") result[t].available += row._count._all;
    if (row.status === "INSPECTION") result[t].inspection += row._count._all;
    if (row.status === "MAINTENANCE" || row.status === "MISSING_PARTS") {
      result[t].maintenance += row._count._all;
    }
    if (row.status === "DISABLED" || row.status === "DEFECTIVE") result[t].disabled += row._count._all;
    if (row.status === "LOST") result[t].lost += row._count._all;
  }
  return result;
}

async function getCountsByType() {
  const stats = await inventoryAssetService.getStatistics();
  // Map rich stats into legacy shape + new fields
  const result = {};
  for (const t of ["PS3", "PS4", "PS5"]) {
    const s = stats[t];
    result[t] = {
      total: s.totalUnits,
      available: s.available,
      reserved: s.reserved,
      rented: s.rented,
      inspection: s.inspection,
      maintenance: s.maintenance,
      disabled: s.disabled,
      lost: s.lost,
      occupancyRate: s.occupancyRate,
      completedRentals: s.completedRentals,
      revenue: s.revenue,
      // Legacy: "rented" in menu meant occupied (reserved+rented)
      band: s.reserved + s.rented,
    };
  }
  return result;
}

async function setCount(consoleType, targetCount, adminContext = {}) {
  const count = Math.max(0, Math.round(Number(targetCount)));
  if (!Number.isFinite(count)) throw new Error("Son noto'g'ri");

  return prisma.$transaction(async (tx) => {
    const units = await tx.inventoryUnit.findMany({
      where: { consoleType },
      orderBy: { unitCode: "asc" },
    });
    const current = units.length;
    const protectedCount = units.filter((u) =>
      NON_DELETABLE_STATUSES.includes(u.status)
    ).length;

    if (count < protectedCount) {
      throw new Error(
        `${consoleType}: faol/band ${protectedCount} ta — ${count} taga kamaytirib bo'lmaydi`
      );
    }

    if (count > current) {
      const codes = units.map((u) => u.unitCode);
      const toAdd = count - current;
      for (let i = 0; i < toAdd; i++) {
        const unitCode = inventoryAssetService.nextUnitCode(consoleType, codes);
        codes.push(unitCode);
        const created = await tx.inventoryUnit.create({
          data: {
            unitCode,
            consoleType,
            displayName: unitCode,
            status: AssetStatus.AVAILABLE,
          },
        });
        await inventoryAssetService.logHistory(tx, created.id, {
          action: "CREATED",
          fromStatus: null,
          toStatus: AssetStatus.AVAILABLE,
          note: "Created via setCount",
          actorType: "admin",
          actorId: adminContext.adminId,
        });
      }
    } else if (count < current) {
      const removable = units.filter((u) => u.status === AssetStatus.AVAILABLE);
      const toRemove = current - count;
      if (removable.length < toRemove) {
        throw new Error(`${consoleType}: yetarli bo'sh qurilma yo'q`);
      }
      const ids = removable.slice(-toRemove).map((u) => u.id);
      await tx.inventoryUnit.deleteMany({ where: { id: { in: ids } } });
    }

    await auditLogService.log({
      adminId: adminContext.adminId,
      adminTelegramId: adminContext.telegramId,
      action: "INVENTORY_COUNT_UPDATED",
      entityType: "InventoryUnit",
      beforeData: { consoleType, count: current },
      afterData: {
        consoleType,
        count,
        message: `Admin ${consoleType} sonini ${current} tadan ${count} taga o'zgartirdi`,
      },
    });

    // Return via outer getCountsByType after commit — compute from tx
    const grouped = await tx.inventoryUnit.groupBy({
      by: ["consoleType", "status"],
      _count: { _all: true },
    });
    return buildCountsFromGrouped(grouped);
  });
}

async function getUnitsByType(consoleType) {
  return prisma.inventoryUnit.findMany({
    where: { consoleType },
    orderBy: { unitCode: "asc" },
  });
}

async function logHistory(inventoryUnitId, meta) {
  return inventoryAssetService.logHistory(prisma, inventoryUnitId, meta);
}

async function getUnitById(id) {
  try {
    return await inventoryAssetService.getAssetDetails(id);
  } catch (err) {
    if (err.code === "NOT_FOUND") return null;
    throw err;
  }
}

async function updateUnit(id, data, adminContext = {}) {
  return inventoryAssetService.updateAsset(id, data, adminContext);
}

function formatUnitDetail(unit) {
  if (!unit) return "Qurilma topilmadi.";
  if (unit.assetCode || unit.totalRentals != null) {
    return inventoryAssetService.formatAssetDetailHtml(unit);
  }
  const { escapeHtml } = require("../utils/telegramFormat");
  const lines = [
    `🏷 <b>${escapeHtml(unit.unitCode)}</b>`,
    `Model: ${escapeHtml(unit.consoleType)}`,
    `Holat: ${escapeHtml(statusLabel(unit.status))}`,
    `Sotib olingan: ${unit.purchasedAt ? escapeHtml(formatDate(unit.purchasedAt)) : "—"}`,
    unit.adminNote ? `Izoh: ${escapeHtml(unit.adminNote)}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Reserve AVAILABLE → RESERVED and link to order (race-safe).
 */
async function assignUnitToOrder(orderId, consoleType, meta = {}) {
  return prisma.$transaction(async (tx) => {
    return inventoryAssetService.reserveForOrder(tx, {
      orderId,
      consoleType,
      actorType: meta.actorType || "system",
      actorId: meta.actorId || null,
    });
  });
}

async function releaseUnit(orderId, tx = null) {
  const orderResourceService = require("./orderResource.service");
  const client = tx || prisma;
  const order = await client.order.findUnique({
    where: { id: Number(orderId) },
    include: orderResourceService.RELEASE_INCLUDE,
  });
  if (!order) return;
  await orderResourceService.releaseOrderResources(client, order, {
    reason: "RELEASE_UNIT",
    releaseItems: false,
  });
}

function formatInventoryMenu(counts) {
  const lines = ["🎮 <b>PlayStation inventar boshqaruvi</b>", ""];
  for (const t of ["PS3", "PS4", "PS5"]) {
    const c = counts[t];
    const occupied = (c.reserved ?? 0) + (c.rented ?? 0);
    const occ =
      c.occupancyRate != null
        ? `${c.occupancyRate}%`
        : c.total
          ? `${Math.round((occupied / c.total) * 100)}%`
          : "0%";
    lines.push(
      `<b>${t}</b> — Jami: ${c.total} | Bo'sh: ${c.available} | Bron: ${c.reserved ?? 0} | Ijara: ${c.rented ?? 0}`
    );
    lines.push(
      `  Tekshiruv: ${c.inspection ?? 0} | Ta'mir: ${c.maintenance ?? 0} | Occupancy: ${occ}`
    );
  }
  lines.push("", "Sonni o'zgartirish uchun modelni tanlang.");
  return lines.join("\n");
}

module.exports = {
  getUnitsByType,
  getCountsByType,
  setCount,
  getUnitById,
  updateUnit,
  formatUnitDetail,
  assignUnitToOrder,
  releaseUnit,
  formatInventoryMenu,
  logHistory,
};
