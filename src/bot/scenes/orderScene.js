const sessionStore = require("../sessionStore");
const userKeyboards = require("../keyboards/user.keyboards");
const pricingService = require("../../services/pricing.service");
const orderService = require("../../services/order.service");
const { quickDateOptions, formatDatetime } = require("../../utils/dateHelper");
const { PricingError } = require("../../errors/pricing.errors");

const STEPS = {
  CONSOLE: "order:console",
  RENTAL: "order:rental",
  DATE: "order:date",
  DATE_MANUAL: "order:date_manual",
  TIME: "order:time",
  PROMO_CHOICE: "order:promo_choice",
  PROMO_INPUT: "order:promo_input",
  CONFIRM: "order:confirm",
};

/** Buyurtma jarayonini boshlaydi — konsol turini so'raydi */
async function start(bot, chatId) {
  const maintenanceService = require("../../services/maintenance.service");
  try {
    await maintenanceService.assertCanCreateOrder(false);
  } catch (err) {
    await bot.sendMessage(chatId, err.message);
    return;
  }

  sessionStore.clearSession(chatId);
  sessionStore.setStep(chatId, STEPS.CONSOLE);

  const consoles = await pricingService.listActiveConsoles();
  if (consoles.length === 0) {
    await bot.sendMessage(chatId, "❗️ Hozircha mavjud konsol turlari yo'q. Keyinroq urinib ko'ring.");
    return;
  }

  await bot.sendMessage(chatId, "🎮 Qaysi konsolni tanlaysiz?", userKeyboards.consoleTypeKeyboard(consoles));
}

async function handleConsoleSelect(bot, chatId, consoleType) {
  try {
    const options = await pricingService.getAvailableRentalOptions(consoleType);
    const consoles = await pricingService.listActiveConsoles();
    const catalog = consoles.find((c) => c.code === consoleType.toUpperCase());

    sessionStore.updateData(chatId, { consoleType: consoleType.toUpperCase() });
    sessionStore.setStep(chatId, STEPS.RENTAL);

    await bot.sendMessage(
      chatId,
      `🎮 ${catalog ? catalog.displayName : consoleType}\n\n⏱ Ijara muddatini tanlang:`,
      userKeyboards.rentalOptionsKeyboard(options)
    );
  } catch (err) {
    const message =
      err instanceof PricingError ? err.message : "Ijara narxlari yuklanmadi. Qaytadan urinib ko'ring.";
    await bot.sendMessage(chatId, `❗️ ${message}`);
    sessionStore.clearSession(chatId);
  }
}

async function handleRentalSelect(bot, chatId, rentalPriceId) {
  sessionStore.updateData(chatId, { rentalPriceId: Number(rentalPriceId) });
  sessionStore.setStep(chatId, STEPS.DATE);
  const options = quickDateOptions();
  sessionStore.updateData(chatId, { _dateOptions: options });
  await bot.sendMessage(chatId, "📅 Ijara boshlanish sanasini tanlang:", userKeyboards.quickDateKeyboard(options));
}

async function handleDateSelect(bot, chatId, index) {
  const session = sessionStore.getSession(chatId);
  if (index === "manual") {
    sessionStore.setStep(chatId, STEPS.DATE_MANUAL);
    await bot.sendMessage(chatId, "📅 Sanani quyidagi formatda kiriting: KK.OO.YYYY (masalan 07.07.2026)");
    return;
  }
  const option = session.data._dateOptions[Number(index)];
  sessionStore.updateData(chatId, { baseDate: option.value });
  sessionStore.setStep(chatId, STEPS.TIME);
  await bot.sendMessage(chatId, "🕒 Boshlanish vaqtini tanlang:", userKeyboards.timeKeyboard());
}

async function handleManualDateText(bot, chatId, text) {
  const match = text.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    await bot.sendMessage(chatId, "❗️ Format noto'g'ri. Masalan: 07.07.2026 ko'rinishida kiriting.");
    return;
  }
  const [, dd, mm, yyyy] = match;
  const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  if (isNaN(date.getTime())) {
    await bot.sendMessage(chatId, "❗️ Sana noto'g'ri kiritildi, qaytadan urinib ko'ring.");
    return;
  }
  sessionStore.updateData(chatId, { baseDate: date.toISOString() });
  sessionStore.setStep(chatId, STEPS.TIME);
  await bot.sendMessage(chatId, "🕒 Boshlanish vaqtini tanlang:", userKeyboards.timeKeyboard());
}

async function handleTimeSelect(bot, chatId, time) {
  const session = sessionStore.getSession(chatId);
  const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    await bot.sendMessage(chatId, "❗️ Vaqt noto'g'ri. Qaytadan tanlang.");
    return;
  }
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const base = new Date(session.data.baseDate);
  base.setHours(hh, mm, 0, 0);
  if (isNaN(base.getTime())) {
    await bot.sendMessage(chatId, "❗️ Sana yoki vaqt noto'g'ri. Qaytadan urinib ko'ring.");
    return;
  }
  sessionStore.updateData(chatId, { startDatetime: base.toISOString() });
  sessionStore.setStep(chatId, STEPS.PROMO_CHOICE);
  await bot.sendMessage(chatId, "🏷️ Promo-kodingiz bormi?", userKeyboards.promocodeKeyboard());
}

async function handlePromoChoice(bot, chatId, choice) {
  if (choice === "enter") {
    sessionStore.setStep(chatId, STEPS.PROMO_INPUT);
    await bot.sendMessage(chatId, "🏷️ Promo-kodni kiriting:");
    return;
  }
  await showConfirmation(bot, chatId);
}

async function handlePromoText(bot, chatId, code, userId) {
  const session = sessionStore.getSession(chatId);
  const rental = await pricingService.getRentalPriceById(session.data.rentalPriceId);
  const result = await pricingService.validatePromocode(code, userId, Number(rental.price));
  if (!result.valid) {
    await bot.sendMessage(chatId, `❗️ ${result.reason}. Qaytadan kiriting yoki /skip yozing.`);
    return;
  }
  const { discount } = require("../../services/promo.service").calculateDiscount(rental.price, result.promo);
  sessionStore.updateData(chatId, { promocode: result });
  await bot.sendMessage(chatId, `✅ Promo-kod qabul qilindi. Chegirma: ${discount.toLocaleString()} so'm`);
  await showConfirmation(bot, chatId);
}

async function showConfirmation(bot, chatId) {
  const session = sessionStore.getSession(chatId);
  const { consoleType, rentalPriceId, startDatetime, promocode } = session.data;

  if (!rentalPriceId) {
    await bot.sendMessage(chatId, "❗️ Sessiya muddati tugagan. Qaytadan buyurtma bering.");
    sessionStore.clearSession(chatId);
    return;
  }

  const rental = await pricingService.getRentalPriceById(rentalPriceId);
  const settingsService = require("../../services/settings.service");
  const rentalSubtotal = pricingService.calculateTotalPrice(
    rental.price,
    promocode && promocode.valid ? promocode.promo : null
  );
  const deliveryFee = await settingsService.getDeliveryFee();
  const grandTotal = rentalSubtotal + deliveryFee;

  sessionStore.setStep(chatId, STEPS.CONFIRM);

  const text =
    `📝 <b>Buyurtmangizni tekshiring:</b>\n\n` +
    `🎮 Konsol: ${rental.consoleName}\n` +
    `⏱ Muddat: ${pricingService.formatDurationLabel(rental.duration)}\n` +
    `🕒 Boshlanish: ${formatDatetime(startDatetime)}\n` +
    `💵 Ijara narxi: ${pricingService.formatMoney(rentalSubtotal, rental.currency)}\n` +
    `🚚 Yetkazib berish: ${pricingService.formatMoney(deliveryFee, rental.currency)}\n` +
    `💰 Jami: ${pricingService.formatMoney(grandTotal, rental.currency)}` +
    (promocode && promocode.valid ? ` (promo -${promocode.promo.discountPercent}% qo'llandi)` : "") +
    `\n\nTasdiqlaysizmi?`;

  await bot.sendMessage(chatId, text, { parse_mode: "HTML", ...userKeyboards.confirmKeyboard() });
}

async function handleConfirm(bot, chatId, user) {
  const session = sessionStore.getSession(chatId);
  if (session.step !== STEPS.CONFIRM) {
    await bot.sendMessage(chatId, "❗️ Sessiya tugagan. Qaytadan buyurtma bering.");
    return;
  }

  const { consoleType, rentalPriceId, startDatetime, promocode } = session.data;
  if (!rentalPriceId || !consoleType || !startDatetime) {
    await bot.sendMessage(chatId, "❗️ Buyurtma ma'lumotlari to'liq emas. Qaytadan urinib ko'ring.");
    sessionStore.clearSession(chatId);
    return;
  }

  try {
    const { order } = await orderService.createOrder({
      userId: user.id,
      userLat: user.latitude,
      userLon: user.longitude,
      address: user.defaultAddress,
      consoleType,
      rentalPriceId,
      startDatetime,
      promocode,
    });

    sessionStore.clearSession(chatId);
    await bot.sendMessage(
      chatId,
      `✅ Buyurtmangiz (#${order.id}) yaratildi!\n\nAdmin va kuryerlarga xabar yuborildi. Tez orada siz bilan bog'lanishadi.`,
      userKeyboards.mainMenuKeyboard()
    );
  } catch (err) {
    await bot.sendMessage(chatId, `❗️ Buyurtma yaratilmadi: ${err.message}`);
  }
}

async function handleCancel(bot, chatId) {
  sessionStore.clearSession(chatId);
  await bot.sendMessage(chatId, "❌ Buyurtma bekor qilindi.");
}

module.exports = {
  STEPS,
  start,
  handleConsoleSelect,
  handleRentalSelect,
  handleDateSelect,
  handleManualDateText,
  handleTimeSelect,
  handlePromoChoice,
  handlePromoText,
  handleConfirm,
  handleCancel,
};
