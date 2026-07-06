const prisma = require("../config/prisma");
const auditLogService = require("./auditLog.service");
const { label: statusLabel } = require("../constants/inventoryStatus");
const { formatDate, formatDatetime } = require("../utils/dateHelper");

function buildCountsFromGrouped(grouped) {
  const types = ["PS3", "PS4", "PS5"];
  const result = {};
  for (const t of types) {
    result[t] = { total: 0, rented: 0, available: 0 };
  }
  for (const row of grouped) {
    const t = row.consoleType;
    result[t].total += row._count._all;
    if (row.status === "RENTED") result[t].rented += row._count._all;
    if (row.status === "AVAILABLE") result[t].available += row._count._all;
  }
  return result;
}

async function getCountsByType() {
  const grouped = await prisma.inventoryUnit.groupBy({
    by: ["consoleType", "status"],
    _count: { _all: true },
  });
  return buildCountsFromGrouped(grouped);
}

function nextUnitCode(consoleType, existingCodes) {
  let max = 0;
  const prefix = `${consoleType}-`;
  for (const code of existingCodes) {
    const num = parseInt(code.replace(prefix, ""), 10);
    if (Number.isFinite(num) && num > max) max = num;
  }
  return `${consoleType}-${String(max + 1).padStart(3, "0")}`;
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
    const rented = units.filter((u) => u.status === "RENTED").length;

    if (count < rented) {
      throw new Error(`${consoleType}: band ${rented} ta — ${count} taga kamaytirib bo'lmaydi`);
    }

    if (count > current) {
      const codes = units.map((u) => u.unitCode);
      const toAdd = count - current;
      for (let i = 0; i < toAdd; i++) {
        const unitCode = nextUnitCode(consoleType, codes);
        codes.push(unitCode);
        await tx.inventoryUnit.create({
          data: { unitCode, consoleType, status: "AVAILABLE" },
        });
      }
    } else if (count < current) {
      const removable = units.filter((u) => u.status === "AVAILABLE");
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
      afterData: { consoleType, count, message: `Admin ${consoleType} sonini ${current} tadan ${count} taga o'zgartirdi` },
    });

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

async function logHistory(inventoryUnitId, { action, fromStatus, toStatus, orderId, note, actorType, actorId }) {
  return prisma.inventoryUnitHistory.create({
    data: { inventoryUnitId, action, fromStatus, toStatus, orderId, note, actorType, actorId },
  });
}

async function getUnitById(id) {
  return prisma.inventoryUnit.findUnique({
    where: { id: Number(id) },
    include: { history: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
}

async function updateUnit(id, data, adminContext = {}) {
  const before = await prisma.inventoryUnit.findUnique({ where: { id: Number(id) } });
  if (!before) throw new Error("Qurilma topilmadi");
  const unit = await prisma.inventoryUnit.update({
    where: { id: Number(id) },
    data: {
      status: data.status ?? undefined,
      purchasedAt: data.purchasedAt ?? undefined,
      purchasePrice: data.purchasePrice ?? undefined,
      lastServiceAt: data.lastServiceAt ?? undefined,
      adminNote: data.adminNote ?? undefined,
    },
  });
  if (data.status && data.status !== before.status) {
    await logHistory(unit.id, {
      action: "STATUS_CHANGED",
      fromStatus: before.status,
      toStatus: data.status,
      note: data.adminNote,
      actorType: "admin",
      actorId: adminContext.adminId,
    });
  }
  await auditLogService.log({
    module: "INVENTORY",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "INVENTORY_UNIT_UPDATED",
    entityType: "InventoryUnit",
    entityId: unit.id,
    beforeData: { status: before.status, adminNote: before.adminNote },
    afterData: { status: unit.status, adminNote: unit.adminNote },
  });
  return unit;
}

function formatUnitDetail(unit) {
  if (!unit) return "Qurilma topilmadi.";
  const lines = [
    `🏷 *${unit.unitCode}*`,
    `Model: ${unit.consoleType}`,
    `Holat: ${statusLabel(unit.status)}`,
    `Sotib olingan: ${unit.purchasedAt ? formatDate(unit.purchasedAt) : "—"}`,
    `Sotib olish narxi: ${unit.purchasePrice ? Number(unit.purchasePrice).toLocaleString() + " so'm" : "—"}`,
    `Oxirgi servis: ${unit.lastServiceAt ? formatDate(unit.lastServiceAt) : "—"}`,
    unit.adminNote ? `Izoh: ${unit.adminNote}` : "",
    "",
    "*Tarix:*",
  ];
  if (!unit.history?.length) lines.push("Tarix bo'sh.");
  else {
    for (const h of unit.history) {
      lines.push(`• ${h.action} ${h.fromStatus ? statusLabel(h.fromStatus) + " → " : ""}${h.toStatus ? statusLabel(h.toStatus) : ""} (${formatDatetime(h.createdAt)})`);
    }
  }
  return lines.filter(Boolean).join("\n");
}

async function assignUnitToOrder(orderId, consoleType) {
  return prisma.$transaction(async (tx) => {
    const unit = await tx.inventoryUnit.findFirst({
      where: { consoleType, status: "AVAILABLE" },
      orderBy: { unitCode: "asc" },
    });
    if (!unit) return null;
    const fromStatus = unit.status;
    await tx.inventoryUnit.update({
      where: { id: unit.id },
      data: { status: "RENTED" },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { inventoryUnitId: unit.id },
    });
    await tx.inventoryUnitHistory.create({
      data: {
        inventoryUnitId: unit.id,
        action: "ASSIGNED_TO_ORDER",
        fromStatus,
        toStatus: "RENTED",
        orderId,
        actorType: "system",
      },
    });
    return unit;
  });
}

async function releaseUnit(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { inventoryUnitId: true },
  });
  if (!order?.inventoryUnitId) return;
  const unit = await prisma.inventoryUnit.findUnique({ where: { id: order.inventoryUnitId } });
  if (!unit) return;
  await prisma.$transaction([
    prisma.inventoryUnit.update({
      where: { id: order.inventoryUnitId },
      data: { status: "AVAILABLE" },
    }),
    prisma.inventoryUnitHistory.create({
      data: {
        inventoryUnitId: unit.id,
        action: "RELEASED_FROM_ORDER",
        fromStatus: unit.status,
        toStatus: "AVAILABLE",
        orderId,
        actorType: "system",
      },
    }),
  ]);
}

function formatInventoryMenu(counts) {
  const lines = ["🎮 *PlayStation inventar boshqaruvi*", ""];
  for (const t of ["PS3", "PS4", "PS5"]) {
    const c = counts[t];
    lines.push(`*${t}* — Jami: ${c.total} | Band: ${c.rented} | Bo'sh: ${c.available}`);
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
};
