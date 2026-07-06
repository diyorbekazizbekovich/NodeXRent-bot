const courierAdminService = require("../../services/courierAdmin.service");
const sessionStore = require("../sessionStore");
const logger = require("../../utils/logger");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const {
  courierAdminMenuKeyboard,
  courierActionsKeyboard,
  courierEditFieldsKeyboard,
} = require("../keyboards/admin.courier.keyboards");

function formatStats(stats) {
  return (
    `📊 <b>Kuryer statistikasi</b>\n\n` +
    `📦 Faol buyurtmalar: ${stats.active}\n` +
    `✅ Yakunlangan: ${stats.completed}\n` +
    `❌ Bekor: ${stats.cancelled}\n` +
    `📈 Jami: ${stats.total}`
  );
}

async function sendCourierCard(bot, chatId, courier) {
  await bot.sendMessage(chatId, courierAdminService.formatCourierLine(courier), {
    parse_mode: "HTML",
    ...courierActionsKeyboard(courier.id, courier.isActive),
  });
}

function registerAdminCourierHandlers(bot, isAdmin) {
  bot.on("callback_query", async (query) => {
    const data = query.data;
    if (!data.startsWith("admin:courier:")) return;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;

    if (!(await isAdmin(telegramId))) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Ruxsat yo'q." });
      return;
    }

    try {
      const parts = data.split(":");

      if (data === "admin:courier:list") {
        const couriers = await courierAdminService.listCouriers({ take: 10 });
        if (couriers.length === 0) {
          await bot.sendMessage(chatId, "📭 Hozircha kuryerlar yo'q.");
        } else {
          await bot.sendMessage(chatId, `📋 <b>Kuryerlar (${couriers.length})</b>`, { parse_mode: "HTML" });
          for (const courier of couriers) {
            await sendCourierCard(bot, chatId, courier);
          }
        }
      } else if (data === "admin:courier:add") {
        sessionStore.clearSession(chatId);
        sessionStore.setStep(chatId, "admin:courier:add:telegramId");
        await bot.sendMessage(
          chatId,
          "➕ <b>Yangi kuryer</b>\n\nTelegram ID kiriting (faqat raqamlar):",
          { parse_mode: "HTML" }
        );
      } else if (data === "admin:courier:search") {
        sessionStore.setStep(chatId, "admin:courier:search");
        await bot.sendMessage(chatId, "🔍 Qidiruv: ism, telefon, username yoki hudud");
      } else if (data === "admin:courier:stats") {
        const platform = await courierAdminService.getPlatformCourierStats();
        await bot.sendMessage(
          chatId,
          `📊 <b>Umumiy statistika</b>\n\n` +
            `👥 Jami kuryerlar: ${platform.total}\n` +
            `✅ Faol: ${platform.active}\n` +
            `🚫 Nofaol: ${platform.inactive}\n` +
            `📦 Jami buyurtmalar: ${platform.totalOrders}`,
          { parse_mode: "HTML" }
        );
      } else if (parts[2] === "detail") {
        const id = Number(parts[3]);
        const { courier, stats } = await courierAdminService.getCourierDetails(id);
        await bot.sendMessage(
          chatId,
          `${courierAdminService.formatCourierLine(courier)}\n\n${formatStats(stats)}`,
          { parse_mode: "HTML", ...courierActionsKeyboard(id, courier.isActive) }
        );
      } else if (parts[2] === "toggle") {
        const id = Number(parts[3]);
        const updated = await courierAdminService.toggleCourierActive(id);
        await bot.sendMessage(
          chatId,
          `#${id} endi <b>${updated.isActive ? "faol" : "nofaol"}</b>.`,
          { parse_mode: "HTML" }
        );
      } else if (parts[2] === "delete") {
        const id = Number(parts[3]);
        await courierAdminService.deleteCourierSafe(id);
        await bot.sendMessage(chatId, `🗑 Kuryer #${id} o'chirildi.`);
      } else if (parts[2] === "edit") {
        const id = Number(parts[3]);
        await bot.sendMessage(chatId, "Nimani tahrirlaysiz?", courierEditFieldsKeyboard(id));
      } else if (parts[2] === "editField") {
        const id = Number(parts[3]);
        const field = parts[4];
        sessionStore.updateData(chatId, { _courierId: id, _editField: field });
        sessionStore.setStep(chatId, "admin:courier:edit:value");
        const prompts = { name: "Yangi ism:", phone: "Yangi telefon:", region: "Yangi hudud:" };
        await bot.sendMessage(chatId, prompts[field] || "Qiymat kiriting:");
      }

      await safeAnswerCallbackQuery(bot, query.id);
    } catch (err) {
      const message = err.name === "CourierAdminError" ? err.message : "Xatolik yuz berdi";
      logger.error("Admin courier handler xatoligi", { context: "AdminCourier", error: err.message });
      await safeAnswerCallbackQuery(bot, query.id, { text: message });
    }
  });
}

async function handleCourierAdminMessage(bot, chatId, msg, session) {
  if (!session.step?.startsWith("admin:courier:")) return false;
  const text = msg.text.trim();

  try {
    if (session.step === "admin:courier:add:telegramId") {
      sessionStore.updateData(chatId, { _telegramId: text });
      sessionStore.setStep(chatId, "admin:courier:add:name");
      await bot.sendMessage(chatId, "To'liq ism kiriting:");
      return true;
    }

    if (session.step === "admin:courier:add:name") {
      sessionStore.updateData(chatId, { _fullName: text });
      sessionStore.setStep(chatId, "admin:courier:add:phone");
      await bot.sendMessage(chatId, "Telefon raqam (+998...):");
      return true;
    }

    if (session.step === "admin:courier:add:phone") {
      const { _telegramId, _fullName } = session.data;
      const courier = await courierAdminService.createCourier({
        telegramId: _telegramId,
        fullName: _fullName,
        phone: text,
      });
      sessionStore.clearSession(chatId);
      await bot.sendMessage(
        chatId,
        `✅ Kuryer qo'shildi: <b>#${courier.id}</b> ${courier.fullName}`,
        { parse_mode: "HTML" }
      );
      return true;
    }

    if (session.step === "admin:courier:search") {
      const results = await courierAdminService.searchCouriers(text);
      sessionStore.clearSession(chatId);
      if (results.length === 0) {
        await bot.sendMessage(chatId, "Hech narsa topilmadi.");
        return true;
      }
      for (const courier of results) {
        await sendCourierCard(bot, chatId, courier);
      }
      return true;
    }

    if (session.step === "admin:courier:edit:value") {
      const { _courierId, _editField } = session.data;
      const patch =
        _editField === "name"
          ? { fullName: text }
          : _editField === "phone"
            ? { phone: text }
            : { region: text };
      await courierAdminService.updateCourier(_courierId, patch);
      sessionStore.clearSession(chatId);
      await bot.sendMessage(chatId, `✅ Kuryer #${_courierId} yangilandi.`);
      return true;
    }
  } catch (err) {
    const message = err.name === "CourierAdminError" ? err.message : "Saqlashda xatolik";
    await bot.sendMessage(chatId, `❗️ ${message}`);
    return true;
  }

  return false;
}

module.exports = {
  courierAdminMenuKeyboard,
  registerAdminCourierHandlers,
  handleCourierAdminMessage,
};
