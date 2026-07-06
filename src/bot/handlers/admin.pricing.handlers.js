const pricingService = require("../../services/pricing.service");
const adminPricingKeyboards = require("../keyboards/admin.pricing.keyboards");
const sessionStore = require("../sessionStore");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { PricingError } = require("../../errors/pricing.errors");

function formatPriceList(prices) {
  if (prices.length === 0) return "Hech qanday narx sozlanmagan.";
  return prices
    .map(
      (p) =>
        `#${p.id} ${p.consoleName} (${p.consoleType}) — ${p.duration} soat: ${pricingService.formatMoney(p.price, p.currency)}${p.isActive ? "" : " [NOFAOL]"}`
    )
    .join("\n");
}

function registerPricingAdmin(bot, isAdmin) {
  bot.on("callback_query", async (query) => {
    const data = query.data;
    if (!data.startsWith("admin:pricing:")) return;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    if (!(await isAdmin(telegramId))) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Ruxsat yo'q." });
      return;
    }

    try {
      if (data === "admin:pricing:list") {
        const prices = await pricingService.listAllRentalPrices({ includeInactive: true });
        await bot.sendMessage(chatId, `💰 <b>Barcha narxlar</b>\n\n${formatPriceList(prices)}`, {
          parse_mode: "HTML",
        });
      } else if (data === "admin:pricing:edit") {
        const prices = await pricingService.listAllRentalPrices({ includeInactive: true });
        sessionStore.setStep(chatId, "admin:pricing:editPick");
        await bot.sendMessage(chatId, "Tahrirlamoqchi bo'lgan narxni tanlang:", adminPricingKeyboards.rentalPriceSelectKeyboard(prices));
      } else if (data === "admin:pricing:add") {
        const consoles = await pricingService.listAllConsolesWithPrices();
        sessionStore.setStep(chatId, "admin:pricing:addConsolePick");
        await bot.sendMessage(chatId, "Qaysi konsol uchun yangi muddat qo'shasiz?", adminPricingKeyboards.consoleSelectKeyboard(consoles, "admin:pricing:addFor"));
      } else if (data === "admin:pricing:toggle") {
        const prices = await pricingService.listAllRentalPrices({ includeInactive: true });
        sessionStore.setStep(chatId, "admin:pricing:togglePick");
        await bot.sendMessage(chatId, "Faol/nofaol qilmoqchi bo'lgan narxni tanlang:", adminPricingKeyboards.rentalPriceSelectKeyboard(prices, "toggle"));
      } else if (data === "admin:pricing:consoles") {
        const consoles = await pricingService.listAllConsolesWithPrices();
        const lines = consoles
          .map((c) => `• ${c.displayName} (${c.code}) — ${c.rentalPrices.length} ta narx ${c.isActive ? "✅" : "🚫"}`)
          .join("\n");
        await bot.sendMessage(chatId, `🎮 <b>Konsol turlari</b>\n\n${lines || "Yo'q"}`, { parse_mode: "HTML" });
      } else if (data === "admin:pricing:addConsole") {
        sessionStore.setStep(chatId, "admin:pricing:newConsoleCode");
        await bot.sendMessage(chatId, "Yangi konsol kodi (masalan PS5_PRO):");
      } else if (data.startsWith("admin:pricing:pick:")) {
        const id = Number(data.split(":")[3]);
        sessionStore.updateData(chatId, { _rentalPriceId: id });
        sessionStore.setStep(chatId, "admin:pricing:editValue");
        const rental = await pricingService.getRentalPriceById(id);
        await bot.sendMessage(
          chatId,
          `Yangi narxni kiriting (${rental.consoleName}, ${rental.duration} soat, hozir: ${pricingService.formatMoney(rental.price, rental.currency)}):`
        );
      } else if (data.startsWith("admin:pricing:addFor:")) {
        const consoleId = Number(data.split(":")[3]);
        const consoles = await pricingService.listAllConsolesWithPrices();
        const catalog = consoles.find((c) => c.id === consoleId);
        if (!catalog) {
          await bot.sendMessage(chatId, "Konsol topilmadi.");
        } else {
          sessionStore.updateData(chatId, { _consoleCode: catalog.code });
          sessionStore.setStep(chatId, "admin:pricing:addHours");
          await bot.sendMessage(chatId, `${catalog.displayName} uchun necha soatlik muddat? (masalan 96):`);
        }
      } else if (data.startsWith("admin:pricing:toggle:")) {
        const id = Number(data.split(":")[3]);
        const rental = await pricingService.getRentalPriceById(id);
        await pricingService.updateRentalPriceOption(id, { isActive: !rental.isActive });
        await bot.sendMessage(chatId, `✅ #${id} endi ${rental.isActive ? "nofaol" : "faol"}.`);
        sessionStore.clearSession(chatId);
      }

      await safeAnswerCallbackQuery(bot, query.id);
    } catch (err) {
      await safeAnswerCallbackQuery(bot, query.id, { text: err.message || "Xatolik" });
    }
  });
}

async function handlePricingAdminMessage(bot, chatId, msg, session) {
  if (!session.step || !session.step.startsWith("admin:pricing:")) return false;

  const text = msg.text.trim();

  if (session.step === "admin:pricing:newConsoleCode") {
    sessionStore.updateData(chatId, { _consoleCode: text.toUpperCase() });
    sessionStore.setStep(chatId, "admin:pricing:newConsoleName");
    await bot.sendMessage(chatId, "Konsol nomini kiriting (masalan PlayStation 5 Pro):");
    return true;
  }

  if (session.step === "admin:pricing:newConsoleName") {
    const { _consoleCode } = session.data;
    await pricingService.createConsoleType({ code: _consoleCode, displayName: text });
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, `✅ Konsol yaratildi: ${_consoleCode} — ${text}`);
    return true;
  }

  if (session.step === "admin:pricing:addHours") {
    sessionStore.updateData(chatId, { _hours: Number(text) });
    sessionStore.setStep(chatId, "admin:pricing:addPrice");
    await bot.sendMessage(chatId, "Narxni kiriting (so'm):");
    return true;
  }

  if (session.step === "admin:pricing:addPrice") {
    const { _consoleCode, _hours } = session.data;
    try {
      await pricingService.createRentalPriceOption({
        consoleType: _consoleCode,
        duration: _hours,
        price: Number(text),
      });
      sessionStore.clearSession(chatId);
      await bot.sendMessage(chatId, `✅ ${_consoleCode} — ${_hours} soat uchun narx qo'shildi.`);
    } catch (err) {
      await bot.sendMessage(chatId, `❗️ ${err instanceof PricingError ? err.message : err.message}`);
    }
    return true;
  }

  if (session.step === "admin:pricing:editValue") {
    const { _rentalPriceId } = session.data;
    await pricingService.updateRentalPriceOption(_rentalPriceId, { price: Number(text) });
    sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, `✅ Narx yangilandi: ${Number(text).toLocaleString()} so'm`);
    return true;
  }

  return false;
}

module.exports = { registerPricingAdmin, handlePricingAdminMessage, formatPriceList };
