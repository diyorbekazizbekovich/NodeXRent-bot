const userService = require("../../services/user.service");
const orderService = require("../../services/order.service");
const pricingService = require("../../services/pricing.service");
const userKeyboards = require("../keyboards/user.keyboards");
const orderScene = require("../scenes/orderScene");
const sessionStore = require("../sessionStore");
const logger = require("../../utils/logger");
const rentalExtensionService = require("../../services/rentalExtension.service");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const userOrderHistoryService = require("../../services/userOrderHistory.service");
const { ACTIVE_RENTAL_STATUSES, LOCATION_UPDATABLE_STATUSES } = require("../../constants/orderStatus");
const { t, resolveLang, languageKeyboard, matchMenuAction, normalizeLang } = require("../../i18n");
const { formatDatetime } = require("../../utils/dateHelper");
const {
  registerUserSupportHandlers,
  handleUserSupportMessage,
} = require("./user.support.handlers");
const { STEPS: SUPPORT_STEPS } = require("../../constants/supportChat");
const { wasMessageHandled } = require("../helpers/handledMessage");
const { addCallbackHandler } = require("../events/callbackRouter");
const orderLocationService = require("../../services/orderLocation.service");
const locationUpdateHelper = require("../helpers/locationUpdate.helper");

const USER_CALLBACK_PREFIXES = [
  "lang:",
  "console:",
  "rental:",
  "date:",
  "time:",
  "promo:",
  "extend:",
  "order:",
  "rate:",
];

function isUserCallback(data) {
  return USER_CALLBACK_PREFIXES.some((p) => data?.startsWith(p));
}

async function continueAfterLanguage(bot, chatId, user, fullName) {
  const L = resolveLang(user.language);

  if (!user.phone) {
    await bot.sendMessage(
      chatId,
      t("welcome.hello", L, { name: fullName || user.fullName || "" }),
      userKeyboards.contactRequestKeyboard(L)
    );
    return;
  }

  if (!user.defaultAddress && !(user.latitude && user.longitude)) {
    await bot.sendMessage(chatId, t("welcome.askLocation", L), userKeyboards.locationRequestKeyboard(L));
    return;
  }

  await bot.sendMessage(chatId, t("welcome.mainMenu", L), userKeyboards.mainMenuKeyboard(L));
}

function register(bot) {
  registerUserSupportHandlers(bot);

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");

    const user = await userService.findOrCreateUser(telegramId, fullName, msg.from.username);

    if (!user.language) {
      await bot.sendMessage(chatId, t("lang.choose", "UZ"), languageKeyboard());
      return;
    }

    await continueAfterLanguage(bot, chatId, user, fullName);
  });

  bot.on("contact", async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const session = sessionStore.getSession(chatId);
    if (session.step === SUPPORT_STEPS.USER_REPLY) {
      await handleUserSupportMessage(bot, msg);
      return;
    }
    if (msg.contact.user_id && msg.contact.user_id !== telegramId) return;

    const user = await userService.updatePhone(telegramId, msg.contact.phone_number);
    const L = resolveLang(user.language);
    await bot.sendMessage(chatId, t("welcome.phoneSaved", L), userKeyboards.locationRequestKeyboard(L));
  });

  bot.on("location", async (msg) => {
    const session = sessionStore.getSession(msg.chat.id);
    if (session.step === SUPPORT_STEPS.USER_REPLY) {
      await handleUserSupportMessage(bot, msg);
      return;
    }
    await locationUpdateHelper.handleCustomerLocation(bot, msg);
  });

  bot.on("edited_message", async (msg) => {
    if (!msg.location) return;
    const session = sessionStore.getSession(msg.chat.id);
    if (session.step === SUPPORT_STEPS.USER_REPLY) return;
    await locationUpdateHelper.handleCustomerLocation(bot, msg);
  });

  bot.on("message", async (msg) => {
    if (msg.contact || msg.location) return;
    if (await handleUserSupportMessage(bot, msg)) return;
  });

  bot.on("message", async (msg) => {
    if (!msg.text) return;
    if (msg.contact || msg.location) return;
    if (wasMessageHandled(msg)) return;

    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text.trim();
    const session = sessionStore.getSession(chatId);

    if (session.step === SUPPORT_STEPS.USER_REPLY) return;

    if (session.step === orderScene.STEPS.PROMO_INPUT) {
      if (/^\/skip\b/i.test(text) || text.toLowerCase() === "skip") {
        return orderScene.handlePromoSkip(bot, chatId);
      }
      if (text.startsWith("/")) return;
      const promoUser = await userService.getUserByTelegramId(telegramId);
      return orderScene.handlePromoText(bot, chatId, text, promoUser?.id);
    }

    if (text.startsWith("/")) return;

    if (session.step === orderScene.STEPS.DATE_MANUAL) {
      return orderScene.handleManualDateText(bot, chatId, text);
    }

    const user = await userService.getUserByTelegramId(telegramId);
    const L = resolveLang(user?.language);

    if (user && !user.defaultAddress && !(user.latitude && user.longitude) && user.phone) {
      await userService.updateLocation(telegramId, { address: text, latitude: null, longitude: null });
      await bot.sendMessage(chatId, t("welcome.locationSaved", L), userKeyboards.mainMenuKeyboard(L));
      return;
    }

    if (
      user &&
      (session.step === locationUpdateHelper.STEPS.CHANGE_ADDRESS ||
        session.step === locationUpdateHelper.STEPS.UPDATE_LOCATION)
    ) {
      const targetOrderId = Number(session.data?._locOrderId) || null;
      try {
        if (targetOrderId) {
          const result = await orderLocationService.updateDeliveryLocation({
            orderId: targetOrderId,
            userId: user.id,
            address: text,
          });
          sessionStore.clearSession(chatId);
          const key = result.order.courierId ? "locationUpdate.saved" : "locationUpdate.savedNoCourier";
          await bot.sendMessage(chatId, t(key, L, { id: result.order.id }), userKeyboards.mainMenuKeyboard(L));
          return;
        }

        const updatable = await orderLocationService.listUpdatableOrders(user.id);
        if (updatable.length) {
          const result = await orderLocationService.updateDeliveryLocation({
            orderId: updatable[0].id,
            userId: user.id,
            address: text,
          });
          sessionStore.clearSession(chatId);
          const key = result.order.courierId ? "locationUpdate.saved" : "locationUpdate.savedNoCourier";
          await bot.sendMessage(chatId, t(key, L, { id: result.order.id }), userKeyboards.mainMenuKeyboard(L));
          return;
        }

        await userService.updateLocation(telegramId, { address: text, latitude: null, longitude: null });
        sessionStore.clearSession(chatId);
        await bot.sendMessage(chatId, t("locationUpdate.profileOnly", L), userKeyboards.mainMenuKeyboard(L));
        return;
      } catch (err) {
        await bot.sendMessage(
          chatId,
          t("locationUpdate.fail", L, {
            error: locationUpdateHelper.formatLocationError(err, L),
          })
        );
        return;
      }
    }

    const action = matchMenuAction(text);
    if (!action) return;

    switch (action) {
      case "order": {
        if (!user || !user.phone || !(user.defaultAddress || (user.latitude && user.longitude))) {
          await bot.sendMessage(chatId, t("welcome.needRegister", L));
          return;
        }
        return orderScene.start(bot, chatId);
      }
      case "extend": {
        const orders = await orderService.listUserOrders(user.id, { take: 20 });
        const active = orders.filter((o) => ACTIVE_RENTAL_STATUSES.includes(o.status));
        if (!active.length) {
          await bot.sendMessage(chatId, t("extend.none", L));
          return;
        }
        const rows = active.map((o) => [
          {
            text: t("extend.pickItem", L, {
              id: o.id,
              console: o.consoleType,
              end: formatDatetime(o.endDatetime),
            }),
            callback_data: `extend:pick:${o.id}`,
          },
        ]);
        await bot.sendMessage(chatId, t("extend.pick", L), {
          reply_markup: { inline_keyboard: rows },
        });
        return;
      }
      case "myOrders": {
        const orders = await orderService.listUserOrders(user.id, { take: 15 });
        if (orders.length === 0) {
          await bot.sendMessage(chatId, t("myOrders.empty", L));
          return;
        }
        const body = userOrderHistoryService.formatUserOrdersList(orders, L);
        if (body.length <= 4000) {
          await bot.sendMessage(chatId, body, { parse_mode: "HTML" });
        } else {
          for (const order of orders.slice(0, 8)) {
            await bot.sendMessage(chatId, userOrderHistoryService.formatUserOrderCard(order, L), {
              parse_mode: "HTML",
            });
          }
        }
        const updatable = orders.filter(
          (o) => LOCATION_UPDATABLE_STATUSES.includes(o.status) && !o.paymentReceived
        );
        if (updatable.length === 1) {
          await bot.sendMessage(
            chatId,
            t("locationUpdate.prompt", L, { id: updatable[0].id }),
            userKeyboards.orderLocationActionKeyboard(updatable[0].id, L)
          );
        } else if (updatable.length > 1) {
          await bot.sendMessage(
            chatId,
            t("locationUpdate.pickOrder", L),
            userKeyboards.locationUpdatePickKeyboard(updatable, L)
          );
        }
        return;
      }
      case "changeAddress": {
        await locationUpdateHelper.promptChangeAddress(bot, chatId, user);
        return;
      }
      case "help": {
        await bot.sendMessage(chatId, t("help.text", L), { parse_mode: "Markdown" });
        return;
      }
      case "language": {
        await bot.sendMessage(chatId, t("lang.choose", L), languageKeyboard());
        return;
      }
      default:
        return;
    }
  });

  addCallbackHandler("user", async (bot, query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    if (!isUserCallback(data)) return false;

    await safeAnswerCallbackQuery(bot, query.id);

    try {
      if (data.startsWith("lang:")) {
        const lang = normalizeLang(data.split(":")[1]);
        if (!lang) return true;
        const user = await userService.updateLanguage(telegramId, lang);
        const L = resolveLang(lang);

        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: query.message.message_id }
          );
        } catch (_) {}

        const fullName = [query.from.first_name, query.from.last_name].filter(Boolean).join(" ");
        await continueAfterLanguage(bot, chatId, user, fullName);
        return true;
      }

      if (data.startsWith("order:loc:")) {
        const orderId = Number(data.split(":")[2]);
        const user = await userService.getUserByTelegramId(telegramId);
        const L = resolveLang(user?.language);
        if (!user || !Number.isFinite(orderId)) {
          await bot.sendMessage(chatId, t("locationUpdate.notFound", L));
          return true;
        }
        const order = await orderService.getOrderById(orderId);
        if (!order || order.userId !== user.id) {
          await bot.sendMessage(chatId, t("locationUpdate.forbidden", L));
          return true;
        }
        if (!LOCATION_UPDATABLE_STATUSES.includes(order.status) || order.paymentReceived) {
          await bot.sendMessage(chatId, t("locationUpdate.locked", L));
          return true;
        }
        await locationUpdateHelper.promptUpdateForOrder(bot, chatId, order, L);
        return true;
      }

      if (data.startsWith("console:")) {
        await orderScene.handleConsoleSelect(bot, chatId, data.split(":")[1]);
      } else if (data.startsWith("rental:")) {
        await orderScene.handleRentalSelect(bot, chatId, data.split(":")[1]);
      } else if (data.startsWith("date:")) {
        await orderScene.handleDateSelect(bot, chatId, data.split(":")[1]);
      } else if (data.startsWith("time:")) {
        const timeValue = data.split(":").slice(1).join(":");
        await orderScene.handleTimeSelect(bot, chatId, timeValue);
      } else if (data.startsWith("promo:")) {
        await orderScene.handlePromoChoice(bot, chatId, data.split(":")[1]);
      } else if (data.startsWith("extend:pick:")) {
        const orderId = Number(data.split(":")[2]);
        const user = await userService.getUserByTelegramId(telegramId);
        const L = resolveLang(user?.language);
        const order = await orderService.getOrderById(orderId);
        if (!order || order.userId !== user?.id) {
          await bot.sendMessage(chatId, t("extend.notFound", L));
          return true;
        }
        if (!ACTIVE_RENTAL_STATUSES.includes(order.status)) {
          await bot.sendMessage(chatId, t("extend.notActive", L, { status: order.status }));
          return true;
        }
        await bot.sendMessage(
          chatId,
          t("extend.askHours", L, {
            id: orderId,
            console: order.consoleType,
            end: formatDatetime(order.endDatetime),
          }),
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: t("extend.day1", L), callback_data: `extend:req:${orderId}:24` },
                  { text: t("extend.day2", L), callback_data: `extend:req:${orderId}:48` },
                ],
                [{ text: t("extend.day3", L), callback_data: `extend:req:${orderId}:72` }],
              ],
            },
          }
        );
      } else if (data.startsWith("extend:req:")) {
        const [, , orderIdRaw, hoursRaw] = data.split(":");
        const user = await userService.getUserByTelegramId(telegramId);
        const L = resolveLang(user?.language);
        try {
          const result = await rentalExtensionService.requestExtension(
            Number(orderIdRaw),
            user.id,
            Number(hoursRaw),
            L
          );
          await bot.sendMessage(
            chatId,
            t("extend.requested", L, {
              duration: pricingService.formatDurationLabel(result.hours, L),
              price: result.extraPrice.toLocaleString(),
              newEnd: formatDatetime(result.newEnd),
            })
          );
          try {
            await bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              { chat_id: chatId, message_id: query.message.message_id }
            );
          } catch (_) {}
        } catch (err) {
          const errText = err.messageKey ? t(err.messageKey, L) : err.message;
          await bot.sendMessage(chatId, t("extend.fail", L, { error: errText }));
        }
      } else if (data === "order:confirm") {
        const user = await userService.getUserByTelegramId(telegramId);
        const L = resolveLang(user?.language);
        if (!user) {
          await bot.sendMessage(chatId, t("welcome.userNotFound", L));
        } else {
          await orderScene.handleConfirm(bot, chatId, user, query);
          return true;
        }
      } else if (data === "order:cancel") {
        await orderScene.handleCancel(bot, chatId, query);
        return true;
      } else if (data === "order:noop") {
        return true;
      } else if (data.startsWith("rate:")) {
        const [, orderId, rating] = data.split(":");
        const { submitReview } = require("../handlers/reviewHelper");
        await submitReview(bot, chatId, telegramId, Number(orderId), Number(rating));
      }
    } catch (err) {
      logger.error("Callback query handler xatoligi", { context: "Bot", error: err.message });
      const user = await userService.getUserByTelegramId(telegramId).catch(() => null);
      await bot.sendMessage(chatId, t("errors.callback", resolveLang(user?.language)));
    }
    return true;
  });
}

module.exports = { register };
