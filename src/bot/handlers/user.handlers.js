const userService = require("../../services/user.service");
const orderService = require("../../services/order.service");
const pricingService = require("../../services/pricing.service");
const userKeyboards = require("../keyboards/user.keyboards");
const orderScene = require("../scenes/orderScene");
const sessionStore = require("../sessionStore");
const { formatDatetime } = require("../../utils/dateHelper");
const logger = require("../../utils/logger");
const rentalExtensionService = require("../../services/rentalExtension.service");
const { label: orderLabel } = require("../../constants/orderStatus");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");

function register(bot) {
  // ---------- /start ----------
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");

    const user = await userService.findOrCreateUser(telegramId, fullName, msg.from.username);

    if (!user.phone) {
      await bot.sendMessage(
        chatId,
        `Assalomu alaykum, ${fullName}! 👋\n\nPlayStation ijara botiga xush kelibsiz.\nDavom etish uchun telefon raqamingizni yuboring:`,
        userKeyboards.contactRequestKeyboard()
      );
      return;
    }

    if (!user.defaultAddress && !(user.latitude && user.longitude)) {
      await bot.sendMessage(
        chatId,
        "📍 Endi manzilingizni yozing yoki lokatsiyangizni yuboring:",
        userKeyboards.locationRequestKeyboard()
      );
      return;
    }

    await bot.sendMessage(chatId, "🏠 Asosiy menyu:", userKeyboards.mainMenuKeyboard());
  });

  // ---------- Telefon raqam qabul qilish (contact) ----------
  bot.on("contact", async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    if (msg.contact.user_id && msg.contact.user_id !== telegramId) return; // faqat o'zining raqami

    await userService.updatePhone(telegramId, msg.contact.phone_number);
    await bot.sendMessage(
      chatId,
      "✅ Telefon raqamingiz saqlandi.\n\n📍 Endi manzilingizni yozing yoki lokatsiyangizni yuboring:",
      userKeyboards.locationRequestKeyboard()
    );
  });

  // ---------- Lokatsiya qabul qilish ----------
  bot.on("location", async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const { latitude, longitude } = msg.location;

    await userService.updateLocation(telegramId, {
      latitude,
      longitude,
      address: `Lokatsiya: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    });
    await bot.sendMessage(chatId, "✅ Manzilingiz saqlandi.\n\n🏠 Asosiy menyu:", userKeyboards.mainMenuKeyboard());
  });

  // ---------- Matnli xabarlar (menyu tugmalari + scene ichidagi matn kiritish) ----------
  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    if (msg.contact || msg.location) return;

    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text.trim();
    const session = sessionStore.getSession(chatId);

    // Agar foydalanuvchi hozir biror scene bosqichida bo'lsa (masalan manzil yozmoqda yoki promo kiritmoqda)
    if (session.step === orderScene.STEPS.DATE_MANUAL) {
      return orderScene.handleManualDateText(bot, chatId, text);
    }
    if (session.step === orderScene.STEPS.PROMO_INPUT) {
      const promoUser = await userService.getUserByTelegramId(telegramId);
      if (text === "/skip") {
        return orderScene.handlePromoChoice(bot, chatId, "skip");
      }
      return orderScene.handlePromoText(bot, chatId, text, promoUser?.id);
    }

    const user = await userService.getUserByTelegramId(telegramId);

    // Ro'yxatdan o'tmagan bo'lsa manzil sifatida qabul qilish
    if (user && !user.defaultAddress && !(user.latitude && user.longitude) && user.phone) {
      await userService.updateLocation(telegramId, { address: text, latitude: null, longitude: null });
      await bot.sendMessage(chatId, "✅ Manzilingiz saqlandi.\n\n🏠 Asosiy menyu:", userKeyboards.mainMenuKeyboard());
      return;
    }

    switch (text) {
      case "🎮 Buyurtma berish": {
        if (!user || !user.phone || !(user.defaultAddress || (user.latitude && user.longitude))) {
          await bot.sendMessage(chatId, "Iltimos avval /start orqali ro'yxatdan o'ting.");
          return;
        }
        return orderScene.start(bot, chatId);
      }
      case "⏳ Ijara uzaytirish": {
        const orders = await orderService.listUserOrders(user.id, { take: 20 });
        const active = orders.filter((o) => ["DELIVERED", "RETURN_REQUESTED"].includes(o.status));
        if (!active.length) {
          await bot.sendMessage(chatId, "Faol ijaralar topilmadi.");
          return;
        }
        const rows = active.map((o) => [
          { text: `#${o.id} ${o.consoleType}`, callback_data: `extend:pick:${o.id}` },
        ]);
        await bot.sendMessage(chatId, "Qaysi buyurtmani uzaytirmoqchisiz?", {
          reply_markup: { inline_keyboard: rows },
        });
        return;
      }
      case "📋 Buyurtmalarim": {
        const orders = await orderService.listUserOrders(user.id);
        if (orders.length === 0) {
          await bot.sendMessage(chatId, "Sizda hali buyurtmalar yo'q.");
          return;
        }
        const lines = orders.map((o) => {
          const courierInfo = o.courier ? `\n   🚚 ${o.courier.fullName || "—"} | ${o.courier.phone || "—"}` : "";
          return `#${o.id} — ${o.consoleType}, ${pricingService.formatDurationLabel(o.rentalPrice.hours)}, ${formatDatetime(o.startDatetime)} — <b>${orderLabel(o.status)}</b>${courierInfo}`;
        });
        await bot.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML" });
        return;
      }
      case "📍 Manzilni o'zgartirish": {
        await bot.sendMessage(chatId, "📍 Yangi manzilingizni yozing yoki lokatsiya yuboring:", userKeyboards.locationRequestKeyboard());
        return;
      }
      case "ℹ️ Yordam": {
        await bot.sendMessage(
          chatId,
          "📞 *Qo'llab-quvvatlash*\n\n+998 50 024 7999",
          { parse_mode: "Markdown" }
        );
        return;
      }
      default:
        return; // boshqa matnlarni e'tiborsiz qoldiramiz
    }
  });

  // ---------- Callback query'lar (inline tugmalar) ----------
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    try {
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
        await bot.sendMessage(chatId, "Qancha uzaytirmoqchisiz?", {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "1 kun", callback_data: `extend:req:${orderId}:24` },
                { text: "2 kun", callback_data: `extend:req:${orderId}:48` },
              ],
              [{ text: "3 kun", callback_data: `extend:req:${orderId}:72` }],
            ],
          },
        });
      } else if (data.startsWith("extend:req:")) {
        const [, , orderIdRaw, hoursRaw] = data.split(":");
        const user = await userService.getUserByTelegramId(telegramId);
        await rentalExtensionService.requestExtension(Number(orderIdRaw), user.id, Number(hoursRaw));
        await bot.sendMessage(chatId, "✅ Uzaytirish so'rovi yuborildi. Admin tasdiqlashini kuting.");
      } else if (data === "order:confirm") {
        const user = await userService.getUserByTelegramId(telegramId);
        if (!user) {
          await bot.sendMessage(chatId, "❗️ Foydalanuvchi topilmadi. /start buyrug'ini yuboring.");
        } else {
          await orderScene.handleConfirm(bot, chatId, user);
        }
      } else if (data === "order:cancel") {
        await orderScene.handleCancel(bot, chatId);
      } else if (data.startsWith("rate:")) {
        const [, orderId, rating] = data.split(":");
        const { submitReview } = require("../handlers/reviewHelper");
        await submitReview(bot, chatId, telegramId, Number(orderId), Number(rating));
      }
      await safeAnswerCallbackQuery(bot, query.id);
    } catch (err) {
      logger.error("Callback query handler xatoligi", { context: "Bot", error: err.message });
      await safeAnswerCallbackQuery(bot, query.id, { text: "Xatolik yuz berdi, qaytadan urinib ko'ring." });
    }
  });
}

module.exports = { register };
