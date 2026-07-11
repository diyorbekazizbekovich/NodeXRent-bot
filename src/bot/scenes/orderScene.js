const sessionStore = require("../sessionStore");
const userKeyboards = require("../keyboards/user.keyboards");
const pricingService = require("../../services/pricing.service");
const orderService = require("../../services/order.service");
const userService = require("../../services/user.service");
const { quickDateOptions, formatDatetime, startOfDay, zonedDateTime } = require("../../utils/dateHelper");
const { PricingError } = require("../../errors/pricing.errors");
const { t, resolveLang } = require("../../i18n");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const {
  combineDateAndTime,
  getAvailableTimeSlots,
  validateStartDatetime,
  isOrderCreationOpen,
} = require("../../validators/orderDatetime.validator");

const STEPS = {
  CONSOLE: "order:console",
  RENTAL: "order:rental",
  DATE: "order:date",
  DATE_MANUAL: "order:date_manual",
  TIME: "order:time",
  PROMO_CHOICE: "order:promo_choice",
  PROMO_INPUT: "order:promo_input",
  CONFIRM: "order:confirm",
  CONFIRMING: "order:confirming",
};

async function langFor(chatId) {
  const user = await userService.getUserByTelegramId(chatId);
  return resolveLang(user?.language);
}

async function sendTimeSelection(bot, chatId, baseDate, lang) {
  const L = lang || (await langFor(chatId));
  const keyboard = userKeyboards.timeKeyboard(baseDate);
  if (!keyboard) {
    await bot.sendMessage(chatId, t("order.noTimesToday", L));
    sessionStore.setStep(chatId, STEPS.DATE);
    const options = quickDateOptions(new Date(), L);
    sessionStore.updateData(chatId, { _dateOptions: options });
    await bot.sendMessage(chatId, t("order.chooseDate", L), userKeyboards.quickDateKeyboard(options, L));
    return false;
  }

  await bot.sendMessage(chatId, t("order.chooseTime", L), keyboard);
  return true;
}

/** Buyurtma jarayonini boshlaydi — konsol turini so'raydi */
async function start(bot, chatId) {
  const L = await langFor(chatId);
  const maintenanceService = require("../../services/maintenance.service");
  try {
    await maintenanceService.assertCanCreateOrder(false);
  } catch (err) {
    await bot.sendMessage(chatId, err.messageKey ? t(err.messageKey, L) : err.message);
    return;
  }

  if (!isOrderCreationOpen()) {
    await bot.sendMessage(chatId, t("order.outsideWorkingHours", L));
    return;
  }

  sessionStore.clearSession(chatId);
  sessionStore.setStep(chatId, STEPS.CONSOLE);

  const consoles = await pricingService.listActiveConsoles();
  if (consoles.length === 0) {
    await bot.sendMessage(chatId, t("order.noConsoles", L));
    sessionStore.clearSession(chatId);
    return;
  }

  await bot.sendMessage(chatId, t("order.chooseConsole", L), userKeyboards.consoleTypeKeyboard(consoles));
}

async function handleConsoleSelect(bot, chatId, consoleType) {
  const L = await langFor(chatId);
  try {
    const code = consoleType.toUpperCase();
    const consoles = await pricingService.listActiveConsoles();
    const catalog = consoles.find((c) => c.code === code);
    if (!catalog) {
      await bot.sendMessage(chatId, t("order.consoleUnavailable", L));
      return start(bot, chatId);
    }

    const options = await pricingService.getAvailableRentalOptions(code);
    sessionStore.updateData(chatId, { consoleType: code });
    sessionStore.setStep(chatId, STEPS.RENTAL);

    await bot.sendMessage(
      chatId,
      t("order.chooseDuration", L, { name: catalog.displayName }),
      userKeyboards.rentalOptionsKeyboard(options, L)
    );
  } catch (err) {
    const message =
      err instanceof PricingError ? err.message : t("order.pricesLoadFail", L);
    await bot.sendMessage(chatId, `❗️ ${message}`);
    sessionStore.clearSession(chatId);
  }
}

async function handleRentalSelect(bot, chatId, rentalPriceId) {
  const L = await langFor(chatId);
  sessionStore.updateData(chatId, { rentalPriceId: Number(rentalPriceId) });
  sessionStore.setStep(chatId, STEPS.DATE);
  const options = quickDateOptions(new Date(), L);
  sessionStore.updateData(chatId, { _dateOptions: options });
  await bot.sendMessage(chatId, t("order.chooseDate", L), userKeyboards.quickDateKeyboard(options, L));
}

async function handleDateSelect(bot, chatId, index) {
  const L = await langFor(chatId);
  const session = sessionStore.getSession(chatId);
  if (index === "manual") {
    sessionStore.setStep(chatId, STEPS.DATE_MANUAL);
    await bot.sendMessage(chatId, t("order.manualDatePrompt", L));
    return;
  }
  const option = session.data._dateOptions[Number(index)];
  sessionStore.updateData(chatId, { baseDate: option.value });
  sessionStore.setStep(chatId, STEPS.TIME);
  await sendTimeSelection(bot, chatId, option.value, L);
}

async function handleManualDateText(bot, chatId, text) {
  const L = await langFor(chatId);
  const match = text.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    await bot.sendMessage(chatId, t("order.manualDateBadFormat", L));
    return;
  }
  const [, dd, mm, yyyy] = match;
  const date = zonedDateTime(Number(yyyy), Number(mm), Number(dd), 0, 0, 0);
  if (isNaN(date.getTime())) {
    await bot.sendMessage(chatId, t("order.manualDateInvalid", L));
    return;
  }

  if (date.getTime() < startOfDay().getTime()) {
    await bot.sendMessage(chatId, t("order.pastDate", L));
    return;
  }

  sessionStore.updateData(chatId, { baseDate: date.toISOString() });
  sessionStore.setStep(chatId, STEPS.TIME);
  await sendTimeSelection(bot, chatId, date.toISOString(), L);
}

async function handleTimeSelect(bot, chatId, time) {
  const L = await langFor(chatId);
  const session = sessionStore.getSession(chatId);
  if (!session.data.baseDate) {
    await bot.sendMessage(chatId, t("order.needDateFirst", L));
    sessionStore.setStep(chatId, STEPS.DATE);
    const options = quickDateOptions(new Date(), L);
    sessionStore.updateData(chatId, { _dateOptions: options });
    await bot.sendMessage(chatId, t("order.chooseDate", L), userKeyboards.quickDateKeyboard(options, L));
    return;
  }

  const start = combineDateAndTime(session.data.baseDate, time);
  if (!start) {
    await bot.sendMessage(chatId, t("order.badTime", L));
    return;
  }

  const available = getAvailableTimeSlots(session.data.baseDate);
  if (!available.includes(time)) {
    await bot.sendMessage(chatId, t("datetime.pastTime", L));
    sessionStore.setStep(chatId, STEPS.TIME);
    await sendTimeSelection(bot, chatId, session.data.baseDate, L);
    return;
  }

  const validation = validateStartDatetime(start.toISOString());
  if (!validation.valid) {
    const msg =
      validation.code === "PAST_TIME"
        ? t("datetime.pastTime", L)
        : validation.code === "PAST_DATE"
          ? t("datetime.pastDate", L)
          : validation.code === "OUTSIDE_HOURS"
            ? t("datetime.outsideHours", L)
            : validation.code === "NOT_FULL_HOUR"
              ? t("datetime.fullHourOnly", L)
              : t("datetime.invalidStart", L);
    await bot.sendMessage(chatId, msg);
    sessionStore.setStep(chatId, STEPS.TIME);
    await sendTimeSelection(bot, chatId, session.data.baseDate, L);
    return;
  }

  sessionStore.updateData(chatId, { startDatetime: validation.start.toISOString() });
  sessionStore.setStep(chatId, STEPS.PROMO_CHOICE);
  await bot.sendMessage(chatId, t("order.askPromo", L), userKeyboards.promocodeKeyboard(L));
}

async function handlePromoChoice(bot, chatId, choice) {
  const L = await langFor(chatId);
  if (choice === "enter") {
    sessionStore.setStep(chatId, STEPS.PROMO_INPUT);
    await bot.sendMessage(chatId, t("order.enterPromo", L));
    return;
  }
  return handlePromoSkip(bot, chatId);
}

/**
 * Promo o'tkazib yuborish — idempotent.
 */
async function handlePromoSkip(bot, chatId) {
  const L = await langFor(chatId);
  const session = sessionStore.getSession(chatId);
  const allowed = [STEPS.PROMO_INPUT, STEPS.PROMO_CHOICE];
  if (!allowed.includes(session.step)) {
    return false;
  }

  sessionStore.updateData(chatId, { promocode: null });
  sessionStore.setStep(chatId, STEPS.CONFIRM);

  await bot.sendMessage(chatId, t("order.promoSkipped", L));
  await showConfirmation(bot, chatId);
  return true;
}

async function handlePromoText(bot, chatId, code, userId) {
  const L = await langFor(chatId);
  const session = sessionStore.getSession(chatId);
  if (!session.data.rentalPriceId) {
    await bot.sendMessage(chatId, t("order.sessionGone", L));
    sessionStore.clearSession(chatId);
    return;
  }

  const rental = await pricingService.getRentalPriceById(session.data.rentalPriceId);
  const result = await pricingService.validatePromocode(code, userId, Number(rental.price), L);
  if (!result.valid) {
    await bot.sendMessage(chatId, t("order.promoInvalid", L, { reason: result.reason }));
    return;
  }

  const { discount, finalPrice } = require("../../services/promo.service").calculateDiscount(
    rental.price,
    result.promo
  );
  const settingsService = require("../../services/settings.service");
  const deliveryFee = await settingsService.getDeliveryFee();
  const grandTotal = finalPrice + deliveryFee;

  sessionStore.updateData(chatId, { promocode: result });
  await bot.sendMessage(
    chatId,
    t("order.promoAccepted", L, {
      code: result.promo.code,
      base: pricingService.formatMoney(rental.price, "UZS", L),
      discount: pricingService.formatMoney(discount, "UZS", L),
      rental: pricingService.formatMoney(finalPrice, "UZS", L),
      delivery: pricingService.formatMoney(deliveryFee, "UZS", L),
      total: pricingService.formatMoney(grandTotal, "UZS", L),
    }),
    { parse_mode: "HTML" }
  );
  await showConfirmation(bot, chatId);
}

async function showConfirmation(bot, chatId) {
  const L = await langFor(chatId);
  const session = sessionStore.getSession(chatId);
  const { consoleType, rentalPriceId, startDatetime, promocode } = session.data;

  if (!rentalPriceId || !consoleType || !startDatetime) {
    await bot.sendMessage(chatId, t("order.sessionExpired", L));
    sessionStore.clearSession(chatId);
    return;
  }

  const validation = validateStartDatetime(startDatetime);
  if (!validation.valid) {
    const msg =
      validation.code === "PAST_TIME"
        ? t("datetime.pastTime", L)
        : validation.code === "PAST_DATE"
          ? t("datetime.pastDate", L)
          : validation.code === "OUTSIDE_HOURS"
            ? t("datetime.outsideHours", L)
            : validation.code === "NOT_FULL_HOUR"
              ? t("datetime.fullHourOnly", L)
              : t("datetime.invalidStart", L);
    await bot.sendMessage(chatId, msg);
    sessionStore.setStep(chatId, STEPS.TIME);
    await sendTimeSelection(bot, chatId, session.data.baseDate || startDatetime, L);
    return;
  }

  const rental = await pricingService.getRentalPriceById(rentalPriceId);
  if (!rental.isActive || rental.consoleType !== consoleType) {
    await bot.sendMessage(chatId, t("order.priceUnavailable", L));
    sessionStore.clearSession(chatId);
    return;
  }

  const settingsService = require("../../services/settings.service");
  const promoObj = promocode && promocode.valid ? promocode.promo : null;
  const { discount, finalPrice: rentalSubtotal } = require("../../services/promo.service").calculateDiscount(
    rental.price,
    promoObj
  );
  const deliveryFee = await settingsService.getDeliveryFee();
  const grandTotal = rentalSubtotal + deliveryFee;

  sessionStore.setStep(chatId, STEPS.CONFIRM);

  let text =
    `${t("order.confirmTitle", L)}\n\n` +
    `${t("order.confirmConsole", L, { name: rental.consoleName })}\n` +
    `${t("order.confirmDuration", L, { duration: pricingService.formatDurationLabel(rental.duration, L) })}\n` +
    `${t("order.confirmStart", L, { datetime: formatDatetime(startDatetime) })}\n` +
    `${t("order.confirmBase", L, { price: pricingService.formatMoney(rental.price, rental.currency, L) })}\n`;

  if (promoObj && discount > 0) {
    text +=
      `${t("order.confirmPromo", L, {
        code: promoObj.code,
        discount: pricingService.formatMoney(discount, rental.currency, L),
      })}\n` +
      `${t("order.confirmRental", L, {
        price: pricingService.formatMoney(rentalSubtotal, rental.currency, L),
      })}\n`;
  } else {
    text += `${t("order.confirmRental", L, {
      price: pricingService.formatMoney(rentalSubtotal, rental.currency, L),
    })}\n`;
  }

  text +=
    `${t("order.confirmDelivery", L, {
      price: pricingService.formatMoney(deliveryFee, rental.currency, L),
    })}\n` +
    `${t("order.confirmTotal", L, {
      price: pricingService.formatMoney(grandTotal, rental.currency, L),
    })}` +
    `\n\n${t("order.confirmAsk", L)}`;

  const sent = await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    ...userKeyboards.confirmKeyboard(false, L),
  });
  sessionStore.updateData(chatId, { _confirmMessageId: sent.message_id });
}

async function handleConfirm(bot, chatId, user, query) {
  const L = resolveLang(user?.language);
  const session = sessionStore.getSession(chatId);
  if (session.step === STEPS.CONFIRMING) {
    if (query) {
      await safeAnswerCallbackQuery(bot, query.id, { text: t("order.alreadyCreating", L) });
    }
    return;
  }

  if (session.step !== STEPS.CONFIRM) {
    await bot.sendMessage(chatId, t("order.sessionGone", L));
    return;
  }

  const { consoleType, rentalPriceId, startDatetime, promocode, _confirmMessageId } = session.data;
  if (!rentalPriceId || !consoleType || !startDatetime) {
    await bot.sendMessage(chatId, t("order.incomplete", L));
    sessionStore.clearSession(chatId);
    return;
  }

  sessionStore.setStep(chatId, STEPS.CONFIRMING);

  // Ack before createOrder (DB) — router may already have answered (idempotent)
  if (query) {
    await safeAnswerCallbackQuery(bot, query.id, { text: t("order.creating", L) });
  }

  if (_confirmMessageId) {
    try {
      await bot.editMessageReplyMarkup(userKeyboards.loadingConfirmKeyboard(L).reply_markup, {
        chat_id: chatId,
        message_id: _confirmMessageId,
      });
    } catch (_) {}
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

    if (_confirmMessageId) {
      try {
        await bot.editMessageReplyMarkup(userKeyboards.confirmKeyboard(true, L).reply_markup, {
          chat_id: chatId,
          message_id: _confirmMessageId,
        });
      } catch (_) {}
    }

    sessionStore.clearSession(chatId);
    await bot.sendMessage(
      chatId,
      t("order.created", L, { id: order.id }),
      userKeyboards.mainMenuKeyboard(L)
    );
  } catch (err) {
    sessionStore.setStep(chatId, STEPS.CONFIRM);
    if (_confirmMessageId) {
      try {
        await bot.editMessageReplyMarkup(userKeyboards.confirmKeyboard(false, L).reply_markup, {
          chat_id: chatId,
          message_id: _confirmMessageId,
        });
      } catch (_) {}
    }
    const errText = err.messageKey ? t(err.messageKey, L) : err.message;
    await bot.sendMessage(chatId, t("order.createFail", L, { error: errText }));
  }
}

async function handleCancel(bot, chatId, query) {
  const L = await langFor(chatId);
  const session = sessionStore.getSession(chatId);
  if (session.step === STEPS.CONFIRMING) {
    if (query) {
      await safeAnswerCallbackQuery(bot, query.id, { text: t("order.cannotCancelCreating", L) });
    }
    return;
  }

  if (query) {
    await safeAnswerCallbackQuery(bot, query.id);
  }

  const { _confirmMessageId } = session.data || {};
  if (_confirmMessageId) {
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: chatId,
          message_id: _confirmMessageId,
        }
      );
    } catch (_) {}
  }

  sessionStore.clearSession(chatId);
  await bot.sendMessage(chatId, t("order.cancelled", L), userKeyboards.mainMenuKeyboard(L));
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
  handlePromoSkip,
  handlePromoText,
  handleConfirm,
  handleCancel,
};
