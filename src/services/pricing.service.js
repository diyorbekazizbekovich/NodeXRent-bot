const pricingRepository = require("../repositories/pricing.repository");
const { PricingError } = require("../errors/pricing.errors");

function normalizeConsoleCode(consoleType) {
  if (!consoleType || typeof consoleType !== "string") return null;
  return consoleType.trim().toUpperCase();
}

function normalizeDuration(duration) {
  const hours = Number(duration);
  if (!Number.isInteger(hours) || hours <= 0) return null;
  return hours;
}

const ALLOWED_RENTAL_HOURS = [24, 48, 72];

function formatDurationLabel(hours, lang) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(lang);
  const h = Number(hours);
  if (h === 24) return t("order.duration1", L);
  if (h === 48) return t("order.duration2", L);
  if (h === 72) return t("order.duration3", L);
  if (h % 24 === 0) return t("order.durationDays", L, { n: h / 24 });
  return t("order.durationHours", L, { n: h });
}

function formatMoney(amount, currency = "UZS", lang) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(lang);
  const suffix = currency === "UZS" ? t("currency.uzs", L) : ` ${currency}`;
  return `${Number(amount).toLocaleString()}${suffix}`;
}

/**
 * @returns {Promise<{ id: number, consoleType: string, consoleName: string, duration: number, price: number, currency: string }>}
 */
async function getRentalPrice(consoleType, duration) {
  const code = normalizeConsoleCode(consoleType);
  const hours = normalizeDuration(duration);

  if (!code) {
    throw new PricingError("INVALID_CONSOLE_TYPE", "Noto'g'ri konsol turi");
  }
  if (!hours) {
    throw new PricingError("INVALID_DURATION", "Noto'g'ri ijara muddati");
  }

  const catalog = await pricingRepository.findConsoleByCode(code);
  if (!catalog) {
    throw new PricingError("INVALID_CONSOLE_TYPE", "Noto'g'ri konsol turi");
  }

  const rental = await pricingRepository.findActiveByConsoleAndHours(code, hours);
  if (!rental) {
    throw new PricingError(
      "PRICE_NOT_FOUND",
      `${code} uchun ${hours} soatlik ijara narxi topilmadi`
    );
  }

  return {
    id: rental.id,
    consoleType: rental.consoleCatalog.code,
    consoleName: rental.consoleCatalog.displayName,
    duration: rental.hours,
    price: Number(rental.price),
    currency: rental.currency,
  };
}

/**
 * @returns {Promise<Array<{ id: number, duration: number, price: number, currency: string }>>}
 */
async function getAvailableRentalOptions(consoleType) {
  const code = normalizeConsoleCode(consoleType);
  if (!code) {
    throw new PricingError("INVALID_CONSOLE_TYPE", "Noto'g'ri konsol turi");
  }

  const catalog = await pricingRepository.findConsoleByCode(code);
  if (!catalog || !catalog.isActive) {
    throw new PricingError("CONSOLE_NOT_AVAILABLE", `${code} konsoli hozir mavjud emas`);
  }

  const prices = await pricingRepository.findActivePricesByConsoleCode(code);
  const filtered = prices.filter((p) => ALLOWED_RENTAL_HOURS.includes(p.hours));
  if (filtered.length === 0) {
    throw new PricingError("NO_RENTAL_OPTIONS", `${code} uchun faol ijara narxlari yo'q`);
  }

  return filtered.map((p) => ({
    id: p.id,
    duration: p.hours,
    price: Number(p.price),
    currency: p.currency,
  }));
}

async function getRentalPriceById(id) {
  const rental = await pricingRepository.findRentalPriceById(Number(id));
  if (!rental) {
    throw new PricingError("PRICE_NOT_FOUND", "Ijara narxi topilmadi");
  }
  return {
    id: rental.id,
    consoleType: rental.consoleCatalog.code,
    consoleName: rental.consoleCatalog.displayName,
    duration: rental.hours,
    price: Number(rental.price),
    currency: rental.currency,
    isActive: rental.isActive,
  };
}

async function listActiveConsoles() {
  return pricingRepository.findActiveConsoles();
}

async function listAllConsolesWithPrices() {
  return pricingRepository.findAllConsoles();
}

async function listAllRentalPrices(options) {
  const rows = await pricingRepository.findAllRentalPrices(options);
  return rows.map((r) => ({
    id: r.id,
    consoleType: r.consoleCatalog.code,
    consoleName: r.consoleCatalog.displayName,
    duration: r.hours,
    price: Number(r.price),
    currency: r.currency,
    isActive: r.isActive,
  }));
}

async function createConsoleType({ code, displayName, sortOrder }) {
  const normalized = normalizeConsoleCode(code);
  if (!normalized) {
    throw new PricingError("INVALID_CONSOLE_TYPE", "Konsol kodi noto'g'ri");
  }
  const existing = await pricingRepository.findConsoleByCode(normalized);
  if (existing) {
    throw new PricingError("CONSOLE_EXISTS", `${normalized} allaqachon mavjud`);
  }
  return pricingRepository.createConsole({ code: normalized, displayName, sortOrder });
}

async function updateConsoleType(id, data) {
  return pricingRepository.updateConsole(id, data);
}

async function toggleConsoleType(id) {
  const catalog = await pricingRepository.findConsoleById(id);
  if (!catalog) {
    throw new PricingError("CONSOLE_NOT_FOUND", "Konsol topilmadi");
  }
  return pricingRepository.updateConsole(id, { isActive: !catalog.isActive });
}

async function renameConsoleType(id, displayName) {
  const name = String(displayName || "").trim();
  if (!name) {
    throw new PricingError("INVALID_CONSOLE_TYPE", "Konsol nomi bo'sh bo'lishi mumkin emas");
  }
  const catalog = await pricingRepository.findConsoleById(id);
  if (!catalog) {
    throw new PricingError("CONSOLE_NOT_FOUND", "Konsol topilmadi");
  }
  return pricingRepository.updateConsole(id, { displayName: name });
}

async function deleteConsoleType(id) {
  const catalog = await pricingRepository.findConsoleById(id);
  if (!catalog) {
    throw new PricingError("CONSOLE_NOT_FOUND", "Konsol topilmadi");
  }

  const activeOrders = await pricingRepository.countActiveOrdersByConsoleCode(catalog.code);
  if (activeOrders > 0) {
    throw new PricingError(
      "CONSOLE_IN_USE",
      `❌ ${catalog.displayName} (${catalog.code}) o'chirib bo'lmaydi.\n\nSabab: ${activeOrders} ta faol buyurtmada ishlatilmoqda.\nAvval buyurtmalarni yakunlang yoki konsolni nofaol qiling.`
    );
  }

  const linkedOrders = await pricingRepository.countRentalPricesReferencingConsole(catalog.id);
  if (linkedOrders > 0) {
    throw new PricingError(
      "CONSOLE_HAS_HISTORY",
      `❌ ${catalog.displayName} (${catalog.code}) o'chirib bo'lmaydi.\n\nSabab: tarixda ${linkedOrders} ta buyurtma shu konsol narxiga bog'langan.\nO'rniga «Nofaol qilish» ni bosing.`
    );
  }

  try {
    return await pricingRepository.deleteConsole(id);
  } catch (err) {
    if (err.code === "P2003") {
      throw new PricingError(
        "CONSOLE_FK",
        `❌ ${catalog.displayName} o'chirib bo'lmadi — bog'liq ma'lumotlar mavjud.\nO'rniga nofaol qiling.`
      );
    }
    throw err;
  }
}

async function getConsoleById(id) {
  const catalog = await pricingRepository.findConsoleById(id);
  if (!catalog) {
    throw new PricingError("CONSOLE_NOT_FOUND", "Konsol topilmadi");
  }
  return catalog;
}

async function createRentalPriceOption({ consoleType, duration, price, currency = "UZS" }) {
  const code = normalizeConsoleCode(consoleType);
  const hours = normalizeDuration(duration);
  if (!code) throw new PricingError("INVALID_CONSOLE_TYPE", "Noto'g'ri konsol turi");
  if (!hours) throw new PricingError("INVALID_DURATION", "Noto'g'ri ijara muddati");
  if (price == null || Number(price) < 0) {
    throw new PricingError("INVALID_PRICE", "Narx noto'g'ri");
  }

  const catalog = await pricingRepository.findConsoleByCode(code);
  if (!catalog) {
    throw new PricingError("CONSOLE_NOT_FOUND", `${code} konsoli topilmadi`);
  }

  return pricingRepository.createRentalPrice({
    consoleCatalogId: catalog.id,
    hours,
    price,
    currency,
  });
}

async function updateRentalPriceOption(id, data) {
  const rental = await pricingRepository.findRentalPriceById(id);
  if (!rental) {
    throw new PricingError("PRICE_NOT_FOUND", "Ijara narxi topilmadi");
  }
  return pricingRepository.updateRentalPrice(id, data);
}

async function deleteRentalPriceOption(id) {
  const rental = await pricingRepository.findRentalPriceById(id);
  if (!rental) {
    throw new PricingError("PRICE_NOT_FOUND", "Ijara narxi topilmadi");
  }
  return pricingRepository.deleteRentalPrice(id);
}

/** Yakuniy narxni hisoblaydi: bazaviy narx - promo chegirmasi */
function calculateTotalPrice(basePrice, promo) {
  const promoService = require("./promo.service");
  return promoService.calculateDiscount(basePrice, promo).finalPrice;
}

async function validatePromocode(code, userId, orderSubtotal = 0, lang) {
  const promoService = require("./promo.service");
  return promoService.validatePromocode(code, userId, orderSubtotal, lang);
}

async function incrementPromocodeUsage(promocodeId) {
  const promoService = require("./promo.service");
  return promoService.incrementUsage(promocodeId);
}

async function createPromocode(data) {
  const promoService = require("./promo.service");
  return promoService.createPromo(data);
}

module.exports = {
  getRentalPrice,
  getAvailableRentalOptions,
  getRentalPriceById,
  listActiveConsoles,
  listAllConsolesWithPrices,
  listAllRentalPrices,
  createConsoleType,
  updateConsoleType,
  toggleConsoleType,
  renameConsoleType,
  deleteConsoleType,
  getConsoleById,
  createRentalPriceOption,
  updateRentalPriceOption,
  deleteRentalPriceOption,
  validatePromocode,
  calculateTotalPrice,
  incrementPromocodeUsage,
  createPromocode,
  formatMoney,
  formatDurationLabel,
  PricingError,
};
