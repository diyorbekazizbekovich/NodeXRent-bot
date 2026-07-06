class CourierAdminError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CourierAdminError";
    this.code = code;
  }
}

const courierRepository = require("../repositories/courier.repository");

function formatCourierLine(courier) {
  const status = courier.isActive ? "✅ Faol" : "🚫 Nofaol";
  const username = courier.username ? `@${courier.username}` : "—";
  const orders = courier._count?.orders ?? 0;
  const psCount = courier.playstations?.length ?? 0;
  return (
    `<b>#${courier.id}</b> ${courier.fullName || "—"}\n` +
    `📱 ${courier.phone || "—"} | ${username}\n` +
    `🆔 TG: <code>${courier.telegramId}</code>\n` +
    `🏙 ${courier.region || "—"} | 🎮 ${psCount} PS | 📦 ${orders} buyurtma\n` +
    `📌 ${status} | 📅 ${new Date(courier.createdAt).toLocaleDateString("uz-UZ")}`
  );
}

async function listCouriers({ search, take = 15 } = {}) {
  return courierRepository.listAll({ search, take });
}

async function getCourierDetails(id) {
  const courier = await courierRepository.findById(id);
  if (!courier) throw new CourierAdminError("NOT_FOUND", "Kuryer topilmadi");
  const stats = await courierRepository.getStats(id);
  return { courier, stats };
}

async function createCourier({ telegramId, fullName, phone, username, region }) {
  const tg = String(telegramId).trim();
  if (!/^\d{5,20}$/.test(tg)) {
    throw new CourierAdminError("INVALID_TELEGRAM_ID", "Telegram ID noto'g'ri formatda");
  }
  if (!fullName?.trim()) {
    throw new CourierAdminError("INVALID_NAME", "Ism kiritilishi shart");
  }

  const existing = await courierRepository.findByTelegramId(tg);
  if (existing) {
    throw new CourierAdminError("DUPLICATE", "Bu Telegram ID allaqachon ro'yxatdan o'tgan");
  }

  return courierRepository.create({
    telegramId: BigInt(tg),
    fullName: fullName.trim(),
    phone: phone?.trim() || null,
    username: username?.replace(/^@/, "") || null,
    region: region?.trim() || null,
    isActive: true,
  });
}

async function updateCourier(id, data) {
  await getCourierDetails(id);
  const patch = {};
  if (data.fullName != null) patch.fullName = data.fullName.trim();
  if (data.phone != null) patch.phone = data.phone.trim();
  if (data.username != null) patch.username = data.username.replace(/^@/, "");
  if (data.region != null) patch.region = data.region.trim();
  if (typeof data.isActive === "boolean") patch.isActive = data.isActive;
  return courierRepository.update(id, patch);
}

async function toggleCourierActive(id) {
  const { courier } = await getCourierDetails(id);
  return courierRepository.update(id, { isActive: !courier.isActive });
}

async function deleteCourierSafe(id) {
  const { courier, stats } = await getCourierDetails(id);
  if (stats.active > 0) {
    throw new CourierAdminError(
      "HAS_ACTIVE_ORDERS",
      "Faol buyurtmasi bor kuryerni o'chirib bo'lmaydi. Avval nofaol qiling."
    );
  }
  return courierRepository.remove(id);
}

async function getPlatformCourierStats() {
  const couriers = await courierRepository.listAll({ take: 100 });
  const active = couriers.filter((c) => c.isActive).length;
  const inactive = couriers.length - active;
  const totalOrders = couriers.reduce((sum, c) => sum + (c._count?.orders || 0), 0);
  return { total: couriers.length, active, inactive, totalOrders };
}

async function searchCouriers(query) {
  if (!query?.trim()) throw new CourierAdminError("EMPTY_QUERY", "Qidiruv so'zi bo'sh");
  return listCouriers({ search: query.trim(), take: 10 });
}

module.exports = {
  CourierAdminError,
  formatCourierLine,
  listCouriers,
  getCourierDetails,
  createCourier,
  updateCourier,
  toggleCourierActive,
  deleteCourierSafe,
  getPlatformCourierStats,
  searchCouriers,
};
