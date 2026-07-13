const prisma = require("../config/prisma");
const auditLogService = require("./auditLog.service");
const { escapeHtml } = require("../utils/telegramFormat");

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

async function validatePromocode(code, userId, orderSubtotal = 0, lang) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(lang);
  const normalized = normalizeCode(code);
  if (!normalized) return { valid: false, reason: t("promo.empty", L) };

  const promo = await prisma.promocode.findUnique({ where: { code: normalized } });
  if (!promo) return { valid: false, reason: t("promo.notFound", L) };
  if (!promo.isActive) return { valid: false, reason: t("promo.inactive", L) };
  if (promo.expiresAt < new Date()) return { valid: false, reason: t("promo.expired", L) };
  if (promo.usedCount >= promo.usageLimit) return { valid: false, reason: t("promo.limit", L) };

  if (promo.minOrderAmount != null && orderSubtotal < Number(promo.minOrderAmount)) {
    return {
      valid: false,
      reason: t("promo.minOrder", L, {
        amount: `${Number(promo.minOrderAmount).toLocaleString()}${t("currency.uzs", L)}`,
      }),
    };
  }

  if (promo.discountType === "LOYALTY" && userId) {
    const orders = await prisma.order.count({
      where: { userId, status: { in: ["COMPLETED", "RETURNED", "DELIVERED"] } },
    });
    if (orders < (promo.loyaltyMinOrders || 1)) {
      return { valid: false, reason: t("promo.loyalty", L, { n: promo.loyaltyMinOrders }) };
    }
  }

  if (userId && promo.perUserLimit > 0) {
    const userUses = await prisma.order.count({ where: { userId, promocodeId: promo.id } });
    if (userUses >= promo.perUserLimit) {
      return { valid: false, reason: t("promo.perUser", L) };
    }
  }

  const { discount } = calculateDiscount(orderSubtotal || 1, promo);
  if (discount <= 0 && promo.discountType !== "FIXED") {
    return { valid: false, reason: t("promo.noDiscount", L) };
  }

  return { valid: true, promo };
}

async function createPromo(data, adminContext = {}) {
  const code = normalizeCode(data.code);
  if (!code || code.length < 2) throw new Error("Promo-kod matni kerak (kamida 2 belgi)");

  const discountType = data.discountType || "PERCENT";
  const discountPercent = Number(data.discountPercent ?? 0);
  const discountAmount = data.discountAmount != null ? Number(data.discountAmount) : null;
  const usageLimit = Number(data.usageLimit);
  const perUserLimit = Number(data.perUserLimit ?? 1);

  if (discountType === "PERCENT") {
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      throw new Error("Chegirma foizi 1–100 oralig'ida bo'lishi kerak");
    }
  } else if (discountType === "FIXED") {
    if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
      throw new Error("Chegirma summasi musbat bo'lishi kerak");
    }
  }

  if (!Number.isInteger(usageLimit) || usageLimit <= 0) {
    throw new Error("Foydalanish limiti musbat butun son bo'lishi kerak");
  }
  if (!Number.isInteger(perUserLimit) || perUserLimit < 0) {
    throw new Error("Per-user limit 0 yoki undan katta bo'lishi kerak");
  }
  if (!(data.expiresAt instanceof Date) || isNaN(data.expiresAt.getTime())) {
    throw new Error("Amal qilish muddati noto'g'ri");
  }
  if (data.expiresAt.getTime() <= Date.now()) {
    throw new Error("Amal qilish muddati kelajakda bo'lishi kerak");
  }

  const existing = await prisma.promocode.findUnique({ where: { code } });
  if (existing) throw new Error("Bunday promo-kod allaqachon mavjud");

  const promo = await prisma.promocode.create({
    data: {
      code,
      discountType,
      discountPercent: discountType === "PERCENT" ? discountPercent : 0,
      discountAmount: discountType === "FIXED" ? discountAmount : null,
      loyaltyMinOrders: data.loyaltyMinOrders ?? null,
      minOrderAmount: data.minOrderAmount ?? null,
      maxDiscountAmount: data.maxDiscountAmount ?? null,
      perUserLimit,
      description: data.description ?? null,
      usageLimit,
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
  const before = await prisma.promocode.findUnique({
    where: { id: Number(id) },
    include: { _count: { select: { orders: true } } },
  });
  if (!before) throw new Error("Promo-kod topilmadi");
  if (before._count.orders > 0) {
    throw new Error(
      `Bu promo ${before._count.orders} ta buyurtmada ishlatilgan. O'chirish o'rniga nofaol qiling.`
    );
  }

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

function formatPromoDetails(p) {
  const type =
    p.discountType === "FIXED"
      ? `${Number(p.discountAmount || 0).toLocaleString()} so'm`
      : `${p.discountPercent}%`;
  return (
    `🏷️ <b>${escapeHtml(p.code)}</b>\n\n` +
    `Holat: ${p.isActive ? "✅ Faol" : "❌ Nofaol"}\n` +
    `Chegirma: ${escapeHtml(type)}\n` +
    `Limit: ${p.usedCount}/${p.usageLimit}\n` +
    `Per-user: ${p.perUserLimit}\n` +
    `Muddat: ${p.expiresAt.toISOString().slice(0, 10)}\n` +
    (p.minOrderAmount != null
      ? `Min buyurtma: ${Number(p.minOrderAmount).toLocaleString()} so'm\n`
      : "") +
    (p.description ? `Izoh: ${escapeHtml(p.description)}\n` : "")
  );
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
  return `${p.isActive ? "✅" : "❌"} ${escapeHtml(p.code)} — ${escapeHtml(type)} | ${p.usedCount}/${p.usageLimit} | ${p.expiresAt.toISOString().slice(0, 10)}`;
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
  formatPromoDetails,
};
