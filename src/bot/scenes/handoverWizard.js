const sessionStore = require("../sessionStore");
const orderService = require("../../services/order.service");
const inventoryItemService = require("../../services/inventoryItem.service");
const { ITEM_TYPES } = require("../../constants/inventoryItem");
const deliveryHandoverService = require("../../services/deliveryHandover.service");
const { DeliveryHandoverError } = require("../../services/deliveryHandover.service");
const courierKeyboards = require("../keyboards/courier.keyboards");
const invKb = require("../keyboards/courier.inventory.keyboards");
const orderPhotoService = require("../../services/orderPhoto.service");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const logger = require("../../utils/logger");

const STEPS = {
  CONSOLE: "hw:console",
  JOYSTICKS: "hw:joysticks",
  HDMI: "hw:hdmi",
  POWER: "hw:power",
  COLLATERAL: "hw:collateral",
  COLLATERAL_CONFIRM: "hw:collateral_confirm",
  PAYMENT: "hw:payment",
  PHOTO: "hw:photo",
};

const handoverLocks = new Set();

function hwData(chatId) {
  return sessionStore.getSession(chatId).data || {};
}

function patchHw(chatId, patch) {
  sessionStore.updateData(chatId, patch);
}

async function clearKb(bot, query) {
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
  } catch (_) {}
}

async function startHandoverWizard(bot, chatId, orderId) {
  const order = await orderService.getOrderById(orderId);
  if (!order) {
    await bot.sendMessage(chatId, "Buyurtma topilmadi");
    return;
  }

  sessionStore.setStep(chatId, STEPS.CONSOLE);
  patchHw(chatId, {
    _hwOrderId: orderId,
    _hwConsoleId: null,
    _hwJoystickIds: [],
    _hwHdmiId: null,
    _hwPowerId: null,
    _hwCollateral: null,
    _hwPayment: null,
  });

  const consoles = await inventoryItemService.listAvailable(ITEM_TYPES.CONSOLE, {
    consoleType: order.consoleType,
    reservedOrderId: orderId,
  });

  await bot.sendMessage(
    chatId,
    `📍 Topshirish wizard (#${orderId})\n\n` +
      `1️⃣ Qaysi PlayStation topshirilmoqda?\n` +
      `(Faqat AVAILABLE / ushbu order uchun RESERVED)`,
    invKb.consolePickKeyboard(orderId, consoles)
  );

  await deliveryHandoverService.notifyAdminStep(orderId, "Yetib kelindi — topshirish wizard boshlandi");
}

async function askJoysticks(bot, chatId, orderId) {
  sessionStore.setStep(chatId, STEPS.JOYSTICKS);
  const data = hwData(chatId);
  const list = await inventoryItemService.listAvailable(ITEM_TYPES.JOYSTICK, {
    reservedOrderId: orderId,
  });
  await bot.sendMessage(
    chatId,
    `2️⃣ Qaysi 4 ta Joystick topshirildi?\n` +
      `Tanlang (aniq 4 ta). Hozir: ${(data._hwJoystickIds || []).length}/4`,
    invKb.joystickPickKeyboard(orderId, list, data._hwJoystickIds || [])
  );
}

async function askHdmi(bot, chatId, orderId) {
  sessionStore.setStep(chatId, STEPS.HDMI);
  const list = await inventoryItemService.listAvailable(ITEM_TYPES.HDMI, { reservedOrderId: orderId });
  await bot.sendMessage(chatId, `3️⃣ Qaysi HDMI kabel topshirildi? (bitta)`, invKb.singlePickKeyboard(orderId, list, "hdmi"));
}

async function askPower(bot, chatId, orderId) {
  sessionStore.setStep(chatId, STEPS.POWER);
  const list = await inventoryItemService.listAvailable(ITEM_TYPES.POWER, { reservedOrderId: orderId });
  await bot.sendMessage(chatId, `4️⃣ Qaysi Power kabel topshirildi? (bitta)`, invKb.singlePickKeyboard(orderId, list, "power"));
}

async function askCollateral(bot, chatId, orderId) {
  sessionStore.setStep(chatId, STEPS.COLLATERAL);
  await bot.sendMessage(
    chatId,
    `Mijozdan qanday hujjat olindi?`,
    courierKeyboards.handoverCollateralKeyboard(orderId)
  );
}

async function askPayment(bot, chatId, orderId) {
  sessionStore.setStep(chatId, STEPS.PAYMENT);
  await bot.sendMessage(chatId, `To'lov qanday olindi?`, courierKeyboards.handoverPaymentKeyboard(orderId));
}

async function askPhoto(bot, chatId, orderId) {
  sessionStore.setStep(chatId, STEPS.PHOTO);
  patchHw(chatId, { _hwAwaitPhoto: true });
  await bot.sendMessage(
    chatId,
    `📸 Mijoz va ijara shartnomasi birga tushgan suratni yuboring.\n\n` +
      `Majburiy. Faqat bitta rasm.\n` +
      `(PlayStation / joystick / kabel rasmi KERAK EMAS)`
  );
}

/**
 * courier:hw:* va eski courier:handover:* (collateral/pay) callbacklari
 */
async function handleCallback(bot, query, courier, data) {
  const chatId = query.message.chat.id;
  const parts = data.split(":");

  // courier:hw:console:orderId:itemId
  if (parts[1] === "hw") {
    const action = parts[2];
    if (action === "noop") {
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    const orderId = Number(parts[3]);
    if (!Number.isFinite(orderId)) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Noto'g'ri" });
      return true;
    }

    const order = await orderService.getOrderById(orderId);
    if (!order || order.courierId !== courier.id) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Buyurtma topilmadi" });
      return true;
    }

    if (action === "console") {
      const itemId = Number(parts[4]);
      patchHw(chatId, { _hwOrderId: orderId, _hwConsoleId: itemId });
      await clearKb(bot, query);
      await askJoysticks(bot, chatId, orderId);
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (action === "js") {
      const itemId = Number(parts[4]);
      const dataHw = hwData(chatId);
      let selected = [...(dataHw._hwJoystickIds || [])].map(Number);
      if (selected.includes(itemId)) {
        selected = selected.filter((id) => id !== itemId);
      } else {
        if (selected.length >= 4) {
          await safeAnswerCallbackQuery(bot, query.id, { text: "Faqat 4 ta!" });
          return true;
        }
        selected.push(itemId);
      }
      patchHw(chatId, { _hwJoystickIds: selected });
      const list = await inventoryItemService.listAvailable(ITEM_TYPES.JOYSTICK, {
        reservedOrderId: orderId,
      });
      try {
        await bot.editMessageReplyMarkup(invKb.joystickPickKeyboard(orderId, list, selected).reply_markup, {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
      } catch (_) {}
      await safeAnswerCallbackQuery(bot, query.id, { text: `${selected.length}/4` });
      return true;
    }

    if (action === "jsDone") {
      const selected = hwData(chatId)._hwJoystickIds || [];
      if (selected.length !== 4) {
        await safeAnswerCallbackQuery(bot, query.id, { text: "Aniq 4 ta tanlang" });
        return true;
      }
      await clearKb(bot, query);
      await askHdmi(bot, chatId, orderId);
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (action === "hdmi") {
      patchHw(chatId, { _hwHdmiId: Number(parts[4]) });
      await clearKb(bot, query);
      await askPower(bot, chatId, orderId);
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (action === "power") {
      patchHw(chatId, { _hwPowerId: Number(parts[4]) });
      await clearKb(bot, query);
      await askCollateral(bot, chatId, orderId);
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }
  }

  // Eski handover collateral/pay — yangi wizard session bilan
  if (parts[1] === "handover") {
    const sub = parts[2];
    const orderId = Number(parts[3]);
    const dataHw = hwData(chatId);

    if (!dataHw._hwConsoleId || !dataHw._hwHdmiId || !dataHw._hwPowerId || (dataHw._hwJoystickIds || []).length !== 4) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Avval inventarni tanlang" });
      await startHandoverWizard(bot, chatId, orderId);
      return true;
    }

    if (sub === "collateral") {
      const collateralType = parts[4];
      await clearKb(bot, query);
      if (collateralType === "NONE") {
        sessionStore.setStep(chatId, STEPS.COLLATERAL_CONFIRM);
        await bot.sendMessage(
          chatId,
          `⚠️ <b>Diqqat!</b>\n\nMijozdan hech qanday hujjat olinmadi.\n\nHaqiqatan ham davom etishni xohlaysizmi?`,
          { parse_mode: "HTML", ...courierKeyboards.handoverNoneConfirmKeyboard(orderId) }
        );
        await safeAnswerCallbackQuery(bot, query.id);
        return true;
      }
      patchHw(chatId, { _hwCollateral: collateralType });
      await deliveryHandoverService.notifyAdminStep(orderId, "Hujjat olindi", [
        `🪪 ${collateralType}`,
      ]);
      await askPayment(bot, chatId, orderId);
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (sub === "noneConfirm") {
      const answer = parts[4];
      await clearKb(bot, query);
      if (answer === "no") {
        await askCollateral(bot, chatId, orderId);
        await safeAnswerCallbackQuery(bot, query.id);
        return true;
      }
      patchHw(chatId, { _hwCollateral: "NONE" });
      await deliveryHandoverService.notifyAdminStep(orderId, "Hujjat olinmadi (tasdiqlangan)");
      await askPayment(bot, chatId, orderId);
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (sub === "pay") {
      const paymentMethod = parts[4];
      if (!["CASH", "CARD"].includes(paymentMethod)) {
        await safeAnswerCallbackQuery(bot, query.id, { text: "Noto'g'ri to'lov" });
        return true;
      }
      const collateral = hwData(chatId)._hwCollateral;
      if (!collateral) {
        await safeAnswerCallbackQuery(bot, query.id, { text: "Avval hujjat" });
        await askCollateral(bot, chatId, orderId);
        return true;
      }
      patchHw(chatId, { _hwPayment: paymentMethod });
      await clearKb(bot, query);
      await deliveryHandoverService.notifyAdminStep(orderId, "To'lov olindi", [
        `💳 ${paymentMethod}`,
      ]);
      await askPhoto(bot, chatId, orderId);
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }
  }

  return false;
}

/**
 * PHOTO bosqichida rasm qabul qilish
 */
async function handlePhotoMessage(bot, msg, courier) {
  const chatId = msg.chat.id;
  const session = sessionStore.getSession(chatId);

  // photo + message ikkalasi emit bo'lishi mumkin — ikkinchisini yutib yuboramiz
  if (session.data?._hwPhotoProcessing) {
    return true;
  }

  // Session yo'qolgan (masalan bot restart) — jim qolmasin
  if (session.step !== STEPS.PHOTO || !session.data?._hwAwaitPhoto) {
    if (session.data?._hwOrderId || session.step?.startsWith?.("hw:")) {
      await bot.sendMessage(
        chatId,
        "❗️ Topshirish sessiyasi topilmadi yoki muddati o'tgan.\n" +
          "Iltimos, buyurtmada «📍 Yetib keldim» ni qayta bosing va wizardni yakunlang."
      );
      return true;
    }
    return false;
  }

  const fileId = orderPhotoService.extractLargestPhotoFileId(msg);
  if (!fileId) {
    await bot.sendMessage(chatId, "❌ Iltimos faqat rasm yuboring.");
    return true;
  }

  const d = session.data;
  const orderId = d._hwOrderId;
  if (!orderId || !d._hwConsoleId || !d._hwHdmiId || !d._hwPowerId || !d._hwCollateral || !d._hwPayment) {
    await bot.sendMessage(
      chatId,
      "❗️ Wizard ma'lumotlari to'liq emas. «📍 Yetib keldim» orqali qaytadan boshlang."
    );
    sessionStore.clearSession(chatId);
    return true;
  }
  if (!Array.isArray(d._hwJoystickIds) || d._hwJoystickIds.length !== 4) {
    await bot.sendMessage(chatId, "❗️ 4 ta joystick tanlanmagan. Wizardni qaytadan boshlang.");
    return true;
  }

  const lockKey = `${orderId}:${courier.id}`;
  if (handoverLocks.has(lockKey)) {
    await bot.sendMessage(chatId, "⏳ Jarayon davom etmoqda...");
    return true;
  }
  handoverLocks.add(lockKey);
  patchHw(chatId, { _hwPhotoProcessing: true, _hwAwaitPhoto: false });

  try {
    await bot.sendMessage(chatId, "⏳ Shartnoma yaratilmoqda va topshirish yakunlanmoqda...");

    const updated = await deliveryHandoverService.completeHandover({
      orderId,
      courierId: courier.id,
      consoleItemId: d._hwConsoleId,
      joystickIds: d._hwJoystickIds,
      hdmiItemId: d._hwHdmiId,
      powerItemId: d._hwPowerId,
      collateralType: d._hwCollateral,
      paymentMethod: d._hwPayment,
      photoFileId: fileId,
      bot,
    });

    sessionStore.clearSession(chatId);
    await bot.sendMessage(
      chatId,
      `✅ Topshirish muvaffaqiyatli yakunlandi.\n\n` +
        `Buyurtma #${orderId} faol ijaraga o'tkazildi.\n` +
        `Status: ${updated.status}`,
      courierKeyboards.deliveredKeyboard(orderId)
    );
  } catch (err) {
    patchHw(chatId, { _hwPhotoProcessing: false, _hwAwaitPhoto: true });
    const text = err instanceof DeliveryHandoverError ? err.message : "Xatolik";
    logger.error("Handover complete failed", { error: err.message, stack: err.stack });
    await bot.sendMessage(chatId, `❗️ ${text}\n\nRasmni qayta yuborishingiz mumkin.`);
  } finally {
    handoverLocks.delete(lockKey);
  }
  return true;
}

module.exports = {
  STEPS,
  startHandoverWizard,
  handleCallback,
  handlePhotoMessage,
};
