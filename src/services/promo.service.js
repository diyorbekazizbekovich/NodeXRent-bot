const prisma = require("../config/prisma");
const auditLogService = require("./auditLog.service");

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function calculateDiscount(basePrice, promo) {
  const price = Math.max(Number(basePrice) || 0, 0);
  if (!promo || !promo.isActive) return { finalPrice: price, discount: 0 };

  let discount = 0;
  if (promo.discountType === "FIXED") {
    discount = Math.min(Number(promo.discountAmount || 0), price);
  } else {
    const pct = Math.max(0, Math.min(Number(promo.discountPercent || 0), 100));
    discount = (price * pct) / 100;
    if (promo.maxDiscountAmount != null) {
      discount = Math.min(discount, Number(promo.maxDiscountAmount));
    }
  }

  discount = Math.max(0, Math.min(discount, price));
  return { finalPrice: Math.max(price - discount, 0), discount };
}

async function validatePromocode(code, userId, orderSubtotal = 0) {
  const normalized = normalizeCode(code);
  if (!normalized) return { valid: false, reason: "Promo-kod bo'sh" };

  const promo = await prisma.promocode.findUnique({ where: { code: normalized } });
  if (!promo) return { valid: false, reason: "Promo-kod topilmadi" };
  if (!promo.isActive) return { valid: false, reason: "Promo-kod o'chirilgan" };
  if (promo.expiresAt < new Date()) return { valid: false, reason: "Promo-kod muddati tugagan" };
  if (promo.usedCount >= promo.usageLimit) return { valid: false, reason: "Promo-kod limiti tugagan" };

  if (promo.minOrderAmount != null && orderSubtotal < Number(promo.minOrderAmount)) {
    return {
      valid: false,
      reason: `Minimal buyurtma: ${Number(promo.minOrderAmount).toLocaleString()} so'm`,
    };
  }

  if (promo.discountType === "LOYALTY" && userId) {
    const orders = await prisma.order.count({
      where: { userId, status: { in: ["COMPLETED", "RETURNED", "DELIVERED"] } },
    });
    if (orders < (promo.loyaltyMinOrders || 1)) {
      return { valid: false, reason: `Kamida ${promo.loyaltyMinOrders} ta buyurtma kerak` };
    }
  }

  if (userId && promo.perUserLimit > 0) {
    const userUses = await prisma.order.count({ where: { userId, promocodeId: promo.id } });
    if (userUses >= promo.perUserLimit) {
      return { valid: false, reason: "Siz bu promo-kod limitidan foydalangansiz" };
    }
  }

  const { discount } = calculateDiscount(orderSubtotal || 1, promo);
  if (discount <= 0 && promo.discountType !== "FIXED") {
    return { valid: false, reason: "Chegirma qo'llanilmaydi" };
  }

  return { valid: true, promo };
}

async function createPromo(data, adminContext = {}) {
  const code = normalizeCode(data.code);
  if (!code) throw new Error("Promo-kod matni kerak");

  const existing = await prisma.promocode.findUnique({ where: { code } });
  if (existing) throw new Error("Bunday promo-kod allaqachon mavjud");

  const promo = await prisma.promocode.create({
    data: {
      code,
      discountType: data.discountType || "PERCENT",
      discountPercent: data.discountPercent ?? 0,
      discountAmount: data.discountAmount ?? null,
      loyaltyMinOrders: data.loyaltyMinOrders ?? null,
      minOrderAmount: data.minOrderAmount ?? null,
      maxDiscountAmount: data.maxDiscountAmount ?? null,
      perUserLimit: data.perUserLimit ?? 1,
      description: data.description ?? null,
      usageLimit: data.usageLimit,
      expiresAt: data.expiresAt,
      isActive: data.isActive !== false,
    },
  });

  await auditLogService.log({
    module: "PROMO",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "PROMO_CREATED",
    entityType: "Promocode",
    entityId: promo.id,
    afterData: { code: promo.code },
  });

  return promo;
}

async function updatePromo(id, data, adminContext = {}) {
  const before = await prisma.promocode.findUnique({ where: { id: Number(id) } });
  if (!before) throw new Error("Promo-kod topilmadi");

  const promo = await prisma.promocode.update({
    where: { id: Number(id) },
    data: {
      discountType: data.discountType ?? undefined,
      discountPercent: data.discountPercent ?? undefined,
      discountAmount: data.discountAmount ?? undefined,
      loyaltyMinOrders: data.loyaltyMinOrders ?? undefined,
      minOrderAmount: data.minOrderAmount ?? undefined,
      maxDiscountAmount: data.maxDiscountAmount ?? undefined,
      perUserLimit: data.perUserLimit ?? undefined,
      description: data.description ?? undefined,
      usageLimit: data.usageLimit ?? undefined,
      expiresAt: data.expiresAt ?? undefined,
      isActive: data.isActive ?? undefined,
    },
  });

  await auditLogService.log({
    module: "PROMO",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "PROMO_UPDATED",
    entityType: "Promocode",
    entityId: id,
    beforeData: { code: before.code, isActive: before.isActive },
    afterData: { code: promo.code, isActive: promo.isActive },
  });

  return promo;
}

async function deletePromo(id, adminContext = {}) {
  const promo = await prisma.promocode.delete({ where: { id: Number(id) } });
  await auditLogService.log({
    module: "PROMO",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "PROMO_DELETED",
    entityType: "Promocode",
    entityId: id,
    afterData: { code: promo.code },
  });
  return promo;
}

async function togglePromo(id, isActive, adminContext = {}) {
  return updatePromo(id, { isActive }, adminContext);
}

async function listPromos() {
  return prisma.promocode.findMany({ orderBy: { createdAt: "desc" } });
}

async function getPromoStats(id) {
  const promo = await prisma.promocode.findUnique({
    where: { id: Number(id) },
    include: { _count: { select: { orders: true } } },
  });
  if (!promo) return null;
  const revenue = await prisma.order.aggregate({
    where: { promocodeId: promo.id },
    _sum: { totalPrice: true },
  });
  return {
    promo,
    ordersCount: promo._count.orders,
    totalRevenue: Number(revenue._sum.totalPrice ?? 0),
  };
}

async function incrementUsage(promocodeId) {
  return prisma.promocode.update({
    where: { id: promocodeId },
    data: { usedCount: { increment: 1 } },
  });
}

function formatPromoLine(p) {
  const type =
    p.discountType === "FIXED"
      ? `${Number(p.discountAmount).toLocaleString()} so'm`
      : `${p.discountPercent}%`;
  return `${p.isActive ? "✅" : "❌"} ${p.code} — ${type} | ${p.usedCount}/${p.usageLimit} | ${p.expiresAt.toISOString().slice(0, 10)}`;
}

module.exports = {
  normalizeCode,
  calculateDiscount,
  validatePromocode,
  createPromo,
  updatePromo,
  deletePromo,
  togglePromo,
  listPromos,
  getPromoStats,
  incrementUsage,
  formatPromoLine,
};
