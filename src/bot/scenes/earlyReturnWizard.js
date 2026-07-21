/**
 * Customer early-return wizard (before rental period ends).
 * Creates ReturnRequest PENDING_ADMIN — does not change Order/Inventory.
 */
const sessionStore = require("../sessionStore");
const orderService = require("../../services/order.service");
const earlyReturnService = require("../../services/earlyReturn.service");
const { EarlyReturnError } = require("../../services/earlyReturn.service");
const rentalReturnService = require("../../services/rentalReturn.service");
const {
  EarlyReturnReason,
  WizardStep,
  labelReason,
} = require("../../constants/earlyReturn");
const earlyReturnKeyboards = require("../keyboards/earlyReturn.keyboards");
const userKeyboards = require("../keyboards/user.keyboards");
const { formatRemainingDuration, formatDatetime } = require("../../utils/dateHelper");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { t, resolveLang } = require("../../i18n");
const logger = require("../../utils/logger");

function draft(chatId) {
  return { ...(sessionStore.getSession(chatId).data._er || {}) };
}

function saveDraft(chatId, patch) {
  const cur = draft(chatId);
  sessionStore.updateData(chatId, { _er: { ...cur, ...patch } });
}

function clearWizard(chatId) {
  sessionStore.clearSession(chatId);
}

async function startEarlyReturnWizard(bot, chatId, orderId, user) {
  const order = await orderService.getOrderById(orderId);
  if (!order || order.userId !== user.id) {
    await bot.sendMessage(chatId, "Buyurtma topilmadi");
    return;
  }

  const pending = await earlyReturnService.findPendingForOrder(orderId);
  if (pending) {
    await bot.sendMessage(
      chatId,
      `⏳ Bu buyurtma uchun erta qaytarish so'rovi #${pending.id} allaqachon yuborilgan.\n` +
        `Admin javobini kuting.`
    );
    return;
  }

  const remaining = formatRemainingDuration(
    rentalReturnService.getExpectedReturnAt(order)
  );
  const unit = order.inventoryUnit?.unitCode || order.consoleType;

  sessionStore.beginAction(chatId, WizardStep.REASON, {
    _er: {
      orderId,
      userId: user.id,
      reason: null,
      customReason: null,
      pickupAddress: null,
      pickupLatitude: order.latitude ?? user.latitude ?? null,
      pickupLongitude: order.longitude ?? user.longitude ?? null,
      requestedPickupTime: null,
    },
  });

  await bot.sendMessage(
    chatId,
    `↩️ <b>Muddatidan oldin qaytarish</b>\n\n` +
      `📦 Buyurtma #${orderId}\n` +
      `🎮 ${unit}\n` +
      `⏳ Qolgan vaqt: <b>${remaining}</b>\n\n` +
      `Ijara avtomatik tugamaydi — admin tasdiqlashi kerak.\n\n` +
      `Nima sababdan muddatidan oldin qaytarmoqchisiz?`,
    { parse_mode: "HTML", ...earlyReturnKeyboards.reasonKeyboard(orderId) }
  );
}

async function showConfirm(bot, chatId, orderId) {
  const d = draft(chatId);
  const order = await orderService.getOrderById(orderId);
  const remaining = formatRemainingDuration(
    rentalReturnService.getExpectedReturnAt(order || {})
  );
  const unit = order?.inventoryUnit?.unitCode || order?.consoleType || "—";

  sessionStore.setStep(chatId, WizardStep.CONFIRM);
  await bot.sendMessage(
    chatId,
    `📋 <b>So'rovni tasdiqlang</b>\n\n` +
      `📦 Buyurtma: #${orderId}\n` +
      `🎮 Konsol: ${unit}\n` +
      `⏳ Qolgan vaqt: ${remaining}\n\n` +
      `📝 Sabab: ${labelReason(d.reason, d.customReason)}\n` +
      `📍 Manzil: ${d.pickupAddress}\n` +
      `🕒 Olib ketish: ${formatDatetime(d.requestedPickupTime)}\n\n` +
      `Yuborilgandan keyin admin ko'rib chiqadi.`,
    { parse_mode: "HTML", ...earlyReturnKeyboards.confirmKeyboard(orderId) }
  );
}

async function handleCallback(bot, query, user, data) {
  if (!data?.startsWith("er:")) return false;
  const chatId = query.message.chat.id;
  const parts = data.split(":");
  const action = parts[1];
  const orderId = Number(parts[2]);

  await safeAnswerCallbackQuery(bot, query.id);
  const L = resolveLang(user?.language);

  if (action === "cancel") {
    clearWizard(chatId);
    await bot.sendMessage(
      chatId,
      "❌ Erta qaytarish so'rovi bekor qilindi.",
      userKeyboards.mainMenuKeyboard(L)
    );
    return true;
  }

  if (!Number.isFinite(orderId)) {
    await bot.sendMessage(chatId, "Noto'g'ri buyurtma");
    return true;
  }

  // Ensure draft exists
  let d = draft(chatId);
  if (!d.orderId) {
    saveDraft(chatId, { orderId, userId: user.id });
    d = draft(chatId);
  }

  try {
    if (action === "reason") {
      const reason = parts[3];
      if (!Object.values(EarlyReturnReason).includes(reason)) {
        await bot.sendMessage(chatId, "Sabab noto'g'ri");
        return true;
      }
      saveDraft(chatId, { reason, customReason: null });
      if (reason === EarlyReturnReason.OTHER) {
        sessionStore.setStep(chatId, WizardStep.CUSTOM_REASON);
        await bot.sendMessage(chatId, "📝 Sababni qisqa yozing:");
        return true;
      }
      sessionStore.setStep(chatId, WizardStep.ADDRESS);
      await bot.sendMessage(
        chatId,
        "PlayStation qayerdan olib ketilsin?",
        earlyReturnKeyboards.addressKeyboard(orderId)
      );
      return true;
    }

    if (action === "addr") {
      const mode = parts[3];
      const order = await orderService.getOrderById(orderId);
      if (mode === "current") {
        const address =
          order?.address ||
          user.defaultAddress ||
          (order?.latitude != null
            ? `Lokatsiya: ${order.latitude}, ${order.longitude}`
            : null);
        if (!address) {
          sessionStore.setStep(chatId, WizardStep.NEW_ADDRESS);
          await bot.sendMessage(
            chatId,
            "Hozirgi manzil topilmadi. Yangi manzilni yozing:"
          );
          return true;
        }
        saveDraft(chatId, {
          pickupAddress: address,
          pickupLatitude: order?.latitude ?? user.latitude ?? null,
          pickupLongitude: order?.longitude ?? user.longitude ?? null,
        });
        sessionStore.setStep(chatId, WizardStep.PICKUP_TIME);
        await bot.sendMessage(
          chatId,
          "Qachondan boshlab olib ketish mumkin?",
          earlyReturnKeyboards.pickupTimeKeyboard(orderId)
        );
        return true;
      }
      if (mode === "new") {
        sessionStore.setStep(chatId, WizardStep.NEW_ADDRESS);
        await bot.sendMessage(
          chatId,
          "📍 Yangi manzilni yozing (yoki lokatsiya yuboring):"
        );
        return true;
      }
    }

    if (action === "time") {
      const preset = parts[3];
      if (preset === "custom") {
        sessionStore.setStep(chatId, WizardStep.CUSTOM_TIME);
        await bot.sendMessage(
          chatId,
          "📅 Vaqtni kiriting:\nFormat: <code>KK.OO.YYYY SS:DD</code>\nMasalan: <code>20.07.2026 18:00</code>",
          { parse_mode: "HTML" }
        );
        return true;
      }
      const when = earlyReturnService.resolvePickupTime(preset);
      if (!when) {
        await bot.sendMessage(chatId, "Vaqt noto'g'ri");
        return true;
      }
      saveDraft(chatId, { requestedPickupTime: when.toISOString() });
      await showConfirm(bot, chatId, orderId);
      return true;
    }

    if (action === "submit") {
      d = draft(chatId);
      if (!d.reason || !d.pickupAddress || !d.requestedPickupTime) {
        await bot.sendMessage(chatId, "Ma'lumotlar to'liq emas. Qaytadan boshlang.");
        clearWizard(chatId);
        return true;
      }
      const created = await earlyReturnService.createRequest({
        orderId,
        customerId: user.id,
        reason: d.reason,
        customReason: d.customReason,
        pickupAddress: d.pickupAddress,
        pickupLatitude: d.pickupLatitude,
        pickupLongitude: d.pickupLongitude,
        requestedPickupTime: d.requestedPickupTime,
      });
      clearWizard(chatId);
      await bot.sendMessage(
        chatId,
        `✅ Erta qaytarish so'rovi yuborildi (#${created.id}).\n\n` +
          `Admin ko'rib chiqguncha ijara faol qoladi.\n` +
          `Javob kelganda xabar beramiz.`,
        userKeyboards.mainMenuKeyboard(L)
      );
      return true;
    }
  } catch (err) {
    const msg =
      err instanceof EarlyReturnError ? err.message : err.message || "Xatolik";
    logger.error("Early return wizard callback", { error: err.message, data });
    await bot.sendMessage(chatId, `❗️ ${msg}`);
    return true;
  }

  return false;
}

async function handleTextMessage(bot, msg, user) {
  const chatId = msg.chat.id;
  const session = sessionStore.getSession(chatId);
  const step = session.step;
  if (!step || !String(step).startsWith("er:")) return false;

  const text = (msg.text || "").trim();
  const d = draft(chatId);
  const orderId = d.orderId;
  if (!orderId) {
    clearWizard(chatId);
    return false;
  }

  if (/^\/cancel\b/i.test(text) || text === "❌ Bekor qilish") {
    clearWizard(chatId);
    await bot.sendMessage(
      chatId,
      "❌ Erta qaytarish bekor qilindi.",
      userKeyboards.mainMenuKeyboard(resolveLang(user?.language))
    );
    return true;
  }

  try {
    if (step === WizardStep.CUSTOM_REASON) {
      if (text.length < 3) {
        await bot.sendMessage(chatId, "Sabab kamida 3 belgi bo'lsin.");
        return true;
      }
      saveDraft(chatId, { customReason: text.slice(0, 500) });
      sessionStore.setStep(chatId, WizardStep.ADDRESS);
      await bot.sendMessage(
        chatId,
        "PlayStation qayerdan olib ketilsin?",
        earlyReturnKeyboards.addressKeyboard(orderId)
      );
      return true;
    }

    if (step === WizardStep.NEW_ADDRESS) {
      if (text.length < 5) {
        await bot.sendMessage(chatId, "Manzilni batafsilroq yozing.");
        return true;
      }
      saveDraft(chatId, { pickupAddress: text.slice(0, 500) });
      sessionStore.setStep(chatId, WizardStep.PICKUP_TIME);
      await bot.sendMessage(
        chatId,
        "Qachondan boshlab olib ketish mumkin?",
        earlyReturnKeyboards.pickupTimeKeyboard(orderId)
      );
      return true;
    }

    if (step === WizardStep.CUSTOM_TIME) {
      const when = earlyReturnService.parseCustomPickupTime(text);
      if (!when) {
        await bot.sendMessage(
          chatId,
          "Format noto'g'ri. Masalan: 20.07.2026 18:00"
        );
        return true;
      }
      saveDraft(chatId, { requestedPickupTime: when.toISOString() });
      await showConfirm(bot, chatId, orderId);
      return true;
    }
  } catch (err) {
    await bot.sendMessage(chatId, `❗️ ${err.message}`);
    return true;
  }

  return false;
}

async function handleLocationMessage(bot, msg, user) {
  const chatId = msg.chat.id;
  const session = sessionStore.getSession(chatId);
  if (session.step !== WizardStep.NEW_ADDRESS) return false;
  if (!msg.location) return false;

  const d = draft(chatId);
  const orderId = d.orderId;
  const lat = msg.location.latitude;
  const lon = msg.location.longitude;
  saveDraft(chatId, {
    pickupAddress: `Lokatsiya: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    pickupLatitude: lat,
    pickupLongitude: lon,
  });
  sessionStore.setStep(chatId, WizardStep.PICKUP_TIME);
  await bot.sendMessage(
    chatId,
    "📍 Lokatsiya qabul qilindi.\nQachondan boshlab olib ketish mumkin?",
    earlyReturnKeyboards.pickupTimeKeyboard(orderId)
  );
  return true;
}

module.exports = {
  WizardStep,
  startEarlyReturnWizard,
  handleCallback,
  handleTextMessage,
  handleLocationMessage,
};
