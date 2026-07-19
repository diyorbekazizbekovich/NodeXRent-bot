const courierService = require("../../services/courier.service");
const playstationService = require("../../services/playstation.service");
const orderService = require("../../services/order.service");
const orderAssignmentService = require("../../services/orderAssignment.service");
const orderNotificationService = require("../../services/orderNotification.service");
const deliveryHandoverService = require("../../services/deliveryHandover.service");
const rentalReturnService = require("../../services/rentalReturn.service");
const courierKeyboards = require("../keyboards/courier.keyboards");
const sessionStore = require("../sessionStore");
const logger = require("../../utils/logger");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { OrderAssignmentError } = require("../../errors/order.errors");
const handoverWizard = require("../scenes/handoverWizard");
const returnWizard = require("../scenes/returnWizard");
const { addCallbackHandler } = require("../events/callbackRouter");
const { escapeHtml } = require("../../utils/telegramFormat");
const { COURIER_RETURN_ALLOWED_STATUSES, label: statusLabel } = require("../../constants/orderStatus");
const { formatRemainingDuration } = require("../../utils/dateHelper");

const CONSOLE_TYPES = ["PS3", "PS4", "PS5"];

async function clearInlineKeyboard(bot, query) {
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
  } catch (_) {}
}

/** photo + message ikkalasi emit bo'lishi mumkin — bir xil message_id ni bir marta ishlaymiz */
const seenPhotoMessageIds = new Map();

async function handleCourierPhoto(bot, msg) {
  try {
    const mid = msg.message_id;
    const chatId = msg.chat?.id;
    if (mid != null && chatId != null) {
      const key = `${chatId}:${mid}`;
      if (seenPhotoMessageIds.has(key)) return true;
      seenPhotoMessageIds.set(key, Date.now());
      // eski yozuvlarni tozalash
      if (seenPhotoMessageIds.size > 200) {
        const cutoff = Date.now() - 60_000;
        for (const [k, ts] of seenPhotoMessageIds) {
          if (ts < cutoff) seenPhotoMessageIds.delete(k);
        }
      }
    }

    const courier = await courierService.getCourierByTelegramId(msg.from.id);
    if (!courier) return false;

    if (await handoverWizard.handlePhotoMessage(bot, msg, courier)) return true;
    if (await returnWizard.handlePhotoMessage(bot, msg, courier)) return true;

    const session = sessionStore.getSession(msg.chat.id);
    if (String(session.step || "").startsWith("hw:") || String(session.step || "").startsWith("ret:")) {
      await bot.sendMessage(
        msg.chat.id,
        "❗️ Hozir rasm kutilmayapti. Wizard bosqichini tugating yoki qaytadan boshlang."
      );
      return true;
    }
    return false;
  } catch (err) {
    logger.error("Courier photo handler", { error: err.message, stack: err.stack });
    try {
      await bot.sendMessage(msg.chat.id, `❗️ Rasm qabul qilinmadi: ${err.message}`);
    } catch (_) {}
    return true;
  }
}

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

  bot.on("photo", async (msg) => {
    // Backup: ba'zi muhitlarda faqat photo event ishonchli
    await handleCourierPhoto(bot, msg);
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    if (!telegramId) return;

    // Asosiy photo yo'li — message har doim emit bo'ladi
    if (msg.photo) {
      await handleCourierPhoto(bot, msg);
      return;
    }

    const session = sessionStore.getSession(chatId);
    const courier = await courierService.getCourierByTelegramId(telegramId).catch(() => null);

    // Topshirish/qaytarish PHOTO bosqichida non-photo → rad etish
    // Handover PHOTO may live only in DeliverySession (DB) after RAM clear
    let handoverAwaitingPhoto = session.step === handoverWizard.STEPS.PHOTO;
    if (courier && !handoverAwaitingPhoto) {
      try {
        const deliverySessionService = require("../../services/deliverySession.service");
        const ds = await deliverySessionService.getPhotoSessionForCourier(courier.id);
        handoverAwaitingPhoto = Boolean(ds);
      } catch (_) {}
    }
    if (
      courier &&
      (handoverAwaitingPhoto || session.step === returnWizard.STEPS.PHOTO)
    ) {
      await bot.sendMessage(chatId, "❌ Iltimos faqat rasm yuboring.");
      return;
    }

    if (!msg.text || msg.text.startsWith("/")) {
      // /skip for return note
      if (msg.text && /^\/skip\b/i.test(msg.text.trim())) {
        if (courier && (await returnWizard.handleTextMessage(bot, msg, courier))) return;
      }
      return;
    }

    const text = msg.text.trim();
    if (!courier) return;

    if (await returnWizard.handleTextMessage(bot, msg, courier)) return;

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

    // Admin inventar qo'shish wizard (courier emas) — skip
    if (String(session.step || "").startsWith("admin:invitem:")) return;

    const dashboard = await orderAssignmentService.listCourierDashboard(courier.id);

    if (text === "📦 Buyurtmalar") {
      if (dashboard.newOrders.length === 0) {
        await bot.sendMessage(chatId, "Yangi buyurtmalar yo'q.");
        return;
      }
      for (const order of dashboard.newOrders.slice(0, 5)) {
        await bot.sendMessage(chatId, orderNotificationService.buildOrderDetailsText(order), {
          parse_mode: "HTML",
          ...courierKeyboards.newOrderKeyboard(order.id, order.latitude, order.longitude, {
            confirmAllowed: true,
            highPriority: Boolean(order.isHighPriority),
          }),
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
        let kb = courierKeyboards.assignedOrderKeyboard(o.id);
        if (o.status === "ON_THE_WAY") kb = courierKeyboards.onTheWayKeyboard(o.id);
        else if (o.status === "ARRIVED") kb = courierKeyboards.arrivedKeyboard(o.id);
        else if (["DELIVERED", "ACTIVE"].includes(o.status)) {
          const end = rentalReturnService.getExpectedReturnAt(o);
          const remaining = formatRemainingDuration(end);
          kb = courierKeyboards.activeRentalKeyboard(o.id, remaining);
        } else if (COURIER_RETURN_ALLOWED_STATUSES.includes(o.status)) {
          kb = courierKeyboards.returnPickupKeyboard(o.id);
        } else if (o.status === "PICKED_UP") {
          kb = courierKeyboards.pickedUpKeyboard(o.id);
        } else if (o.status === "EXPIRED") {
          kb = {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "⏳ Qaytarish so'rovi kutilmoqda",
                    callback_data: `courier:rentalInfo:${o.id}`,
                  },
                ],
              ],
            },
          };
        }
        const endHint =
          ["DELIVERED", "ACTIVE"].includes(o.status) && rentalReturnService.getExpectedReturnAt(o)
            ? `\n⏳ ${formatRemainingDuration(rentalReturnService.getExpectedReturnAt(o))}`
            : "";
        await bot.sendMessage(
          chatId,
          `#${o.id} — ${o.consoleType} — ${statusLabel(o.status)}${endHint}`,
          { parse_mode: "HTML", ...kb }
        );
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
        `👤 <b>Profil</b>\n\nIsm: ${escapeHtml(courier.fullName || "—")}\nTelefon: ${escapeHtml(courier.phone || "—")}\nHudud: ${escapeHtml(courier.region || "—")}`,
        { parse_mode: "HTML" }
      );
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

  addCallbackHandler("courier", async (bot, query) => {
    const data = query.data;
    if (!data?.startsWith("courier:")) return false;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;

    // Ack before DB / wizard / assignment work (idempotent if router already answered)
    await safeAnswerCallbackQuery(bot, query.id);

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
      return true;
    }

    try {
      const courier = await courierService.getCourierByTelegramId(telegramId);
      if (!courier || !courier.isActive) {
        await bot.sendMessage(chatId, "Kuryer faol emas.");
        return true;
      }

      if (data.startsWith("courier:hw:") || data.startsWith("courier:handover:")) {
        const handled = await handoverWizard.handleCallback(bot, query, courier, data);
        if (handled) return true;
      }

      if (data.startsWith("courier:ret:")) {
        const handled = await returnWizard.handleCallback(bot, query, courier, data);
        if (handled) return true;
      }

      const [, action, orderIdRaw] = data.split(":");
      const orderId = Number(orderIdRaw);

      if (action === "acceptBlocked") {
        await bot.sendMessage(
          chatId,
          "⏳ Bu buyurtma hali admin tomonidan tasdiqlanmagan yoki muddati kelmagan."
        );
      } else if (action === "accept") {
        const order = await orderAssignmentService.acceptOrderByCourier(orderId, courier.id);
        const unitCode = order.inventoryUnit?.unitCode || "—";
        await bot.sendMessage(
          chatId,
          `✅ Buyurtma #${order.id} qabul qilindi (COURIER_ASSIGNED).\n` +
            `🏷 Qurilma: <b>${unitCode}</b>\n` +
            `📌 Status: RESERVED → yetkazib berish`,
          {
            parse_mode: "HTML",
            reply_markup: courierKeyboards.assignedOrderKeyboard(order.id).reply_markup,
          }
        );
        await clearInlineKeyboard(bot, query);
      } else if (action === "reject") {
        await orderAssignmentService.rejectOrderByCourier(orderId, courier.id);
        await bot.sendMessage(
          chatId,
          `❌ Buyurtma #${orderId} rad etildi.\nBoshqa kuryerlarga qayta yuboriladi (agar qolgan bo'lsa).`
        );
        await clearInlineKeyboard(bot, query);
      } else if (action === "location") {
        const order = await orderService.getOrderById(orderId);
        if (order?.latitude != null && order?.longitude != null) {
          const maps = `https://maps.google.com/?q=${order.latitude},${order.longitude}`;
          await bot.sendMessage(
            chatId,
            `📍 <b>Buyurtma #${order.id}</b> manzili\n` +
              `Lat: <code>${Number(order.latitude).toFixed(6)}</code>\n` +
              `Lon: <code>${Number(order.longitude).toFixed(6)}</code>\n` +
              `🔗 <a href="${maps}">Google Maps</a>`,
            { parse_mode: "HTML", disable_web_page_preview: false }
          );
          await bot.sendLocation(chatId, order.latitude, order.longitude);
        } else {
          await bot.sendMessage(chatId, "Lokatsiya mavjud emas.");
        }
      } else if (action === "onway") {
        await orderAssignmentService.updateCourierOrderStatus(orderId, courier.id, "ON_THE_WAY");
        await deliveryHandoverService.notifyAdminStep(orderId, "Buyurtma yo'lga chiqdi");
        await bot.sendMessage(chatId, `🚗 Yo'ldasiz (#${orderId})`, courierKeyboards.onTheWayKeyboard(orderId));
      } else if (action === "arrived") {
        const current = await orderService.getOrderById(orderId);
        if (current?.paymentReceived || ["DELIVERED", "ACTIVE"].includes(current?.status)) {
          const end = rentalReturnService.getExpectedReturnAt(current);
          const remaining = formatRemainingDuration(end);
          await bot.sendMessage(
            chatId,
            `📦 Buyurtma #${orderId} — faol ijara.\n⏳ Ijara tugashiga: ${remaining}`,
            courierKeyboards.activeRentalKeyboard(orderId, remaining)
          );
        } else {
          if (current?.status !== "ARRIVED") {
            await orderAssignmentService.updateCourierOrderStatus(orderId, courier.id, "ARRIVED");
          }
          await handoverWizard.startHandoverWizard(bot, chatId, orderId, courier);
        }
      } else if (action === "delivered") {
        const current = await orderService.getOrderById(orderId);
        if (current?.paymentReceived || ["DELIVERED", "ACTIVE"].includes(current?.status)) {
          const end = rentalReturnService.getExpectedReturnAt(current);
          const remaining = formatRemainingDuration(end);
          await bot.sendMessage(
            chatId,
            `📦 Buyurtma #${orderId} allaqachon faol ijara.\n⏳ Ijara tugashiga: ${remaining}`,
            courierKeyboards.activeRentalKeyboard(orderId, remaining)
          );
        } else {
          await handoverWizard.startHandoverWizard(bot, chatId, orderId, courier);
        }
      } else if (action === "rentalInfo") {
        const current = await orderService.getOrderById(orderId);
        if (!current) {
          await bot.sendMessage(chatId, "Buyurtma topilmadi.");
        } else {
          const end = rentalReturnService.getExpectedReturnAt(current);
          const remaining = end ? formatRemainingDuration(end) : "—";
          const ended = rentalReturnService.isRentalPeriodEnded(current);
          await bot.sendMessage(
            chatId,
            `📦 Buyurtma #${orderId}\n` +
              `Holat: ${statusLabel(current.status)}\n` +
              `Ijara tugashi: ${remaining}\n` +
              (ended
                ? "Mijoz/admin qaytarish so'rovini yaratishi kerak."
                : "Ijara hali davom etmoqda — qaytarib olib bo'lmaydi.")
          );
        }
      } else if (action === "returned") {
        const current = await orderService.getOrderById(orderId);
        if (!current) {
          await bot.sendMessage(chatId, "Buyurtma topilmadi.");
        } else if (["DELIVERED", "ACTIVE"].includes(current.status)) {
          const remaining = formatRemainingDuration(rentalReturnService.getExpectedReturnAt(current));
          await bot.sendMessage(
            chatId,
            `❌ Ijara muddati hali tugamagan.\n⏳ Qolgan vaqt: ${remaining}`,
            courierKeyboards.activeRentalKeyboard(orderId, remaining)
          );
        } else if (!COURIER_RETURN_ALLOWED_STATUSES.includes(current.status)) {
          await bot.sendMessage(
            chatId,
            `Bu holatda qaytarib bo'lmaydi: ${statusLabel(current.status)}`
          );
        } else if (current.courierId !== courier.id) {
          await bot.sendMessage(chatId, "Bu qaytarish sizga biriktirilmagan.");
        } else {
          const started = await returnWizard.startReturnWizard(bot, chatId, orderId);
          if (started === false) {
            await bot.sendMessage(
              chatId,
              `❗️ Buyurtma #${orderId} inventarsiz. Admin orqali yakunlang.`
            );
          }
        }
      } else if (action === "cancel") {
        await orderAssignmentService.updateCourierOrderStatus(orderId, courier.id, "CANCELLED");
        await bot.sendMessage(chatId, `❌ Buyurtma #${orderId} bekor qilindi.`);
      }
    } catch (err) {
      const expected = err instanceof OrderAssignmentError;
      const msg = expected ? err.message : "Xatolik yuz berdi";
      logger[expected ? "warn" : "error"]("Kuryer callback xatoligi", {
        context: "Bot",
        error: err.message,
        code: expected ? err.code : undefined,
      });
      if (expected) await clearInlineKeyboard(bot, query);
      await bot.sendMessage(chatId, msg.slice(0, 180));
    }
    return true;
  });
}

module.exports = { register };
