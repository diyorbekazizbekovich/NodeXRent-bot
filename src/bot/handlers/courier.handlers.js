const courierService = require("../../services/courier.service");
const playstationService = require("../../services/playstation.service");
const orderService = require("../../services/order.service");
const orderAssignmentService = require("../../services/orderAssignment.service");
const orderNotificationService = require("../../services/orderNotification.service");
const courierKeyboards = require("../keyboards/courier.keyboards");
const sessionStore = require("../sessionStore");
const logger = require("../../utils/logger");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { OrderAssignmentError } = require("../../errors/order.errors");

const CONSOLE_TYPES = ["PS3", "PS4", "PS5"];

function register(bot) {
  bot.onText(/\/courier/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");

    await courierService.findOrCreateCourier(telegramId, fullName, msg.from.username);
    await bot.sendMessage(
      chatId,
      "🚚 Siz yetkazib beruvchi sifatida ro'yxatdan o'tdingiz.\n\nTelefon va hudud: /profile",
      courierKeyboards.mainMenuKeyboard()
    );
  });

  bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    const courier = await courierService.getCourierByTelegramId(msg.from.id);
    if (!courier) return;
    sessionStore.setStep(chatId, "courier:profile:phone");
    await bot.sendMessage(chatId, "📱 Telefon raqamingizni yozing (masalan +998901234567):");
  });

  bot.onText(/\/addps/, async (msg) => {
    const chatId = msg.chat.id;
    const courier = await courierService.getCourierByTelegramId(msg.from.id);
    if (!courier) {
      await bot.sendMessage(chatId, "Avval /courier orqali ro'yxatdan o'ting.");
      return;
    }
    sessionStore.setStep(chatId, "courier:addps:type");
    sessionStore.updateData(chatId, { _courierId: courier.id });
    await bot.sendMessage(chatId, `Qaysi konsol turini qo'shmoqchisiz? (${CONSOLE_TYPES.join(" / ")})`);
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text.trim();
    const session = sessionStore.getSession(chatId);
    const courier = await courierService.getCourierByTelegramId(telegramId);
    if (!courier) return;

    if (session.step === "courier:profile:phone") {
      sessionStore.updateData(chatId, { _phone: text });
      sessionStore.setStep(chatId, "courier:profile:region");
      await bot.sendMessage(chatId, "🏙 Hududingizni kiriting:");
      return;
    }
    if (session.step === "courier:profile:region") {
      await courierService.updateCourierProfile(telegramId, {
        phone: session.data._phone,
        region: text,
        username: msg.from.username,
      });
      sessionStore.clearSession(chatId);
      await bot.sendMessage(chatId, "✅ Profil saqlandi. Lokatsiyangizni yuboring:", {
        reply_markup: {
          keyboard: [[{ text: "📍 Lokatsiyani yuborish", request_location: true }]],
          resize_keyboard: true,
        },
      });
      return;
    }
    if (session.step === "courier:addps:type") {
      const type = text.toUpperCase();
      if (!CONSOLE_TYPES.includes(type)) {
        await bot.sendMessage(chatId, `Noto'g'ri tur: ${CONSOLE_TYPES.join(", ")}`);
        return;
      }
      sessionStore.updateData(chatId, { _type: type });
      sessionStore.setStep(chatId, "courier:addps:serial");
      await bot.sendMessage(chatId, "Seriya raqamini kiriting:");
      return;
    }
    if (session.step === "courier:addps:serial") {
      const { _courierId, _type } = session.data;
      await playstationService.addPlaystation(_courierId, {
        type: _type,
        serialNumber: text,
        accessories: { joystick: 2, cable: 1 },
      });
      sessionStore.clearSession(chatId);
      await bot.sendMessage(chatId, `✅ ${_type} qo'shildi.`);
      return;
    }

    const dashboard = await orderAssignmentService.listCourierDashboard(courier.id);

    if (text === "📦 Buyurtmalar") {
      if (dashboard.newOrders.length === 0) {
        await bot.sendMessage(chatId, "Yangi buyurtmalar yo'q.");
        return;
      }
      for (const order of dashboard.newOrders.slice(0, 5)) {
        await bot.sendMessage(chatId, orderNotificationService.buildOrderDetailsText(order), {
          parse_mode: "HTML",
          ...courierKeyboards.newOrderKeyboard(order.id, order.latitude, order.longitude),
        });
      }
      return;
    }
    if (text === "✅ Faol buyurtmalar") {
      if (dashboard.acceptedOrders.length === 0) {
        await bot.sendMessage(chatId, "Faol buyurtmalar yo'q.");
        return;
      }
      for (const o of dashboard.acceptedOrders.slice(0, 10)) {
        await bot.sendMessage(chatId, `#${o.id} — ${o.consoleType} — ${o.status}`, {
          ...courierKeyboards.assignedOrderKeyboard(o.id),
        });
      }
      return;
    }
    if (text === "📜 Tarix") {
      const history = [...dashboard.completedOrders, ...dashboard.cancelledOrders].slice(0, 15);
      const lines = history.map((o) => `#${o.id} — ${o.consoleType} — ${o.status}`);
      await bot.sendMessage(chatId, lines.join("\n") || "Tarix bo'sh.");
      return;
    }
    if (text === "👤 Profil") {
      await bot.sendMessage(
        chatId,
        `👤 *Profil*\n\nIsm: ${courier.fullName || "—"}\nTelefon: ${courier.phone || "—"}\nHudud: ${courier.region || "—"}`,
        { parse_mode: "Markdown" }
      );
      sessionStore.setStep(chatId, "courier:profile:phone");
      await bot.sendMessage(chatId, "Telefon raqamini yangilash uchun yozing yoki /profile buyrug'ini ishlating.");
      return;
    }
    if (text === "⚙️ Sozlamalar") {
      await bot.sendMessage(chatId, "⚙️ Sozlamalar:", courierKeyboards.settingsKeyboard());
      return;
    }
  });

  bot.on("location", async (msg) => {
    const courier = await courierService.getCourierByTelegramId(msg.from.id);
    if (!courier) return;
    await courierService.updateCourierProfile(msg.from.id, {
      phone: courier.phone,
      region: courier.region,
      latitude: msg.location.latitude,
      longitude: msg.location.longitude,
    });
    await bot.sendMessage(msg.chat.id, "✅ Lokatsiya yangilandi.");
  });

  bot.on("callback_query", async (query) => {
    const data = query.data;
    if (!data.startsWith("courier:")) return;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    if (data.startsWith("courier:settings:")) {
      const sub = data.split(":")[2];
      if (sub === "profile") {
        sessionStore.setStep(chatId, "courier:profile:phone");
        await bot.sendMessage(chatId, "📱 Telefon raqamingizni yozing:");
      } else if (sub === "location") {
        await bot.sendMessage(chatId, "📍 Lokatsiyangizni yuboring:", {
          reply_markup: {
            keyboard: [[{ text: "📍 Lokatsiyani yuborish", request_location: true }]],
            resize_keyboard: true,
          },
        });
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    const [, action, orderIdRaw] = data.split(":");
    const orderId = Number(orderIdRaw);

    try {
      const courier = await courierService.getCourierByTelegramId(telegramId);
      if (!courier || !courier.isActive) {
        await safeAnswerCallbackQuery(bot, query.id, { text: "Kuryer faol emas." });
        return;
      }

      if (action === "accept") {
        const order = await orderAssignmentService.acceptOrderByCourier(orderId, courier.id);
        await bot.sendMessage(chatId, `✅ Buyurtma #${order.id} qabul qilindi.`, courierKeyboards.onTheWayKeyboard(order.id));
      } else if (action === "reject") {
        await orderAssignmentService.rejectOrderByCourier(orderId, courier.id);
        await bot.sendMessage(chatId, `❌ Buyurtma #${orderId} rad etildi.`);
      } else if (action === "location") {
        const order = await orderService.getOrderById(orderId);
        if (order?.latitude != null && order?.longitude != null) {
          await bot.sendLocation(chatId, order.latitude, order.longitude);
        } else {
          await bot.sendMessage(chatId, "Lokatsiya mavjud emas.");
        }
      } else if (action === "onway") {
        await orderAssignmentService.updateCourierOrderStatus(orderId, courier.id, "ON_THE_WAY");
        await bot.sendMessage(chatId, `🚗 Yo'ldasiz (#${orderId})`, courierKeyboards.arrivedKeyboard(orderId));
      } else if (action === "arrived") {
        await orderAssignmentService.updateCourierOrderStatus(orderId, courier.id, "ARRIVED");
        await bot.sendMessage(chatId, `📍 Yetib keldingiz (#${orderId})`, courierKeyboards.deliveredKeyboard(orderId));
      } else if (action === "delivered") {
        await orderAssignmentService.updateCourierOrderStatus(orderId, courier.id, "DELIVERED");
        await bot.sendMessage(chatId, `📦 Yetkazildi (#${orderId})`, courierKeyboards.deliveredKeyboard(orderId));
      } else if (action === "returned") {
        await orderAssignmentService.updateCourierOrderStatus(orderId, courier.id, "RETURNED");
        await orderAssignmentService.updateCourierOrderStatus(orderId, courier.id, "COMPLETED");
        await bot.sendMessage(chatId, `✅ Buyurtma #${orderId} yakunlandi.`);
      } else if (action === "cancel") {
        await orderAssignmentService.updateCourierOrderStatus(orderId, courier.id, "CANCELLED");
        await bot.sendMessage(chatId, `❌ Buyurtma #${orderId} bekor qilindi.`);
      }

      await safeAnswerCallbackQuery(bot, query.id);
    } catch (err) {
      const msg = err instanceof OrderAssignmentError ? err.message : "Xatolik yuz berdi";
      logger.error("Kuryer callback xatoligi", { context: "Bot", error: err.message });
      await safeAnswerCallbackQuery(bot, query.id, { text: msg });
    }
  });
}

module.exports = { register };
