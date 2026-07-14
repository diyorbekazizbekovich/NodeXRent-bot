const prisma = require("../../config/prisma");
const env = require("../../config/env");
const adminKeyboards = require("../keyboards/admin.keyboards");
const reportService = require("../../services/report.service");
const dashboardService = require("../../services/dashboard.service");
const inventoryService = require("../../services/inventory.service");
const auditLogService = require("../../services/auditLog.service");
const settingsService = require("../../services/settings.service");
const pricingService = require("../../services/pricing.service");
const orderService = require("../../services/order.service");
const courierService = require("../../services/courier.service");
const userService = require("../../services/user.service");
const { notify } = require("../../services/notification.service");
const sessionStore = require("../sessionStore");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const adminPricingKeyboards = require("../keyboards/admin.pricing.keyboards");
const {
  registerPricingAdmin,
  handlePricingAdminMessage,
} = require("./admin.pricing.handlers");
const { registerAdminOrderHandlers } = require("./admin.order.handlers");
const {
  registerAdminCourierHandlers,
  handleCourierAdminMessage,
  courierAdminMenuKeyboard,
} = require("./admin.courier.handlers");
const dashboardKpiService = require("../../services/dashboardKpi.service");
const adminAlertService = require("../../services/adminAlert.service");
const maintenanceService = require("../../services/maintenance.service");
const rentalExtensionService = require("../../services/rentalExtension.service");
const courierStatsService = require("../../services/courierStats.service");
const realtimeDashboardService = require("../../services/realtimeDashboard.service");
const broadcastService = require("../../services/broadcast.service");
const promoService = require("../../services/promo.service");
const { promoListKeyboard, promoActionKeyboard } = require("../keyboards/admin.promo.keyboards");
const {
  registerAdminCrmHandlers,
  handleCrmAdminMessage,
  showCrmMenu,
} = require("./admin.crm.handlers");
const {
  registerAdminSupportHandlers,
  handleAdminSupportMessage,
} = require("./admin.support.handlers");
const {
  registerAdminAnalyticsHandlers,
  showAnalytics,
} = require("./admin.analytics.handlers");
const {
  registerAdminFactoryResetHandlers,
  handleFactoryResetMessage,
  startFactoryResetFlow,
} = require("./admin.factoryReset.handlers");
const factoryResetService = require("../../services/factoryReset.service");
const { registerAdminBackupHandlers, backupKeyboard } = require("./admin.backup.handlers");
const { registerAdminAuditHandlers } = require("./admin.audit.handlers");
const adminInventoryItem = require("./admin.inventoryItem.handlers");
const adminInventory = require("./admin.inventory.handlers");
const { label, filterGroup } = require("../../constants/orderStatus");
const { buildOrderTimeline } = require("../../utils/orderTimeline");
const { escapeHtml } = require("../../utils/telegramFormat");
const { addCallbackHandler } = require("../events/callbackRouter");

function isAdminMainCallback(data) {
  if (!data) return false;
  return (
    data.startsWith("admin:promo:") ||
    data.startsWith("admin:settings:") ||
    data.startsWith("admin:inv:") ||
    data.startsWith("admin:invitem:") ||
    data.startsWith("admin:orders:") ||
    data.startsWith("admin:order:timeline:") ||
    data.startsWith("admin:ext:") ||
    data.startsWith("admin:dashboard:")
  );
}

/** Reply-keyboard menyu — faol compose/sessionni yutib yubormasligi uchun */
const ADMIN_MENU_TEXTS = new Set([
  "📊 Dashboard",
  "📅 Bugun",
  "👥 CRM",
  "📦 Buyurtmalar",
  "🎮 Inventar",
  "🎮 PlayStationlar",
  "📈 Analytics",
  "🚚 Kuryerlar",
  "💰 Narxlar",
  "💾 Backup",
  "📋 Loglar",
  "🏷️ Promo",
  "🏷️ Promo-kodlar",
  "📢 Reklama",
  "⚙️ Sozlamalar",
  "📊 Statistika",
  "👥 Foydalanuvchilar",
  "🗑 Bazani tozalash",
]);

async function isAdmin(telegramId) {
  if (env.ADMIN_TELEGRAM_IDS.includes(Number(telegramId))) return true;
  const admin = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
  return Boolean(admin);
}

function register(bot) {
  registerPricingAdmin(bot, isAdmin);
  registerAdminOrderHandlers(bot, isAdmin);
  registerAdminCourierHandlers(bot, isAdmin);
  registerAdminCrmHandlers(bot, isAdmin);
  registerAdminSupportHandlers(bot, isAdmin);
  registerAdminAnalyticsHandlers(bot, isAdmin);
  registerAdminFactoryResetHandlers(bot, isAdmin);
  registerAdminBackupHandlers(bot, isAdmin);
  registerAdminAuditHandlers(bot, isAdmin);

  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    if (!(await isAdmin(telegramId))) {
      await bot.sendMessage(chatId, "Sizda admin huquqlari yo'q.");
      return;
    }
    const [stats, alertSection] = await Promise.all([
      dashboardKpiService.getKpiStats(),
      adminAlertService.formatDashboardAlertsSection(),
    ]);
    const text =
      alertSection +
      "\n\n" +
      dashboardKpiService.formatKpiDashboard(stats) +
      "\n\n<i>🔄 Real-time dashboard faol</i>";
    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      ...adminKeyboards.mainMenuKeyboard({
        isSuperAdmin: factoryResetService.isSuperAdmin(telegramId),
      }),
    });
    if (await realtimeDashboardService.isEnabled(telegramId)) {
      realtimeDashboardService.subscribe(chatId, sent.message_id);
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    if (!(await isAdmin(telegramId))) return;

    if (await adminInventoryItem.handleText(bot, msg)) return;
    if (await adminInventory.handleText(bot, msg, { telegramId })) return;

    let session = sessionStore.getSession(chatId);

    // Menyu tugmasi bosilsa — compose/sessionni tozalab, menyuga o'tkazamiz
    // (aks holda support/CRM/ads session Analytics va boshqa tugmalarni yutib yuboradi)
    if (msg.text && ADMIN_MENU_TEXTS.has(msg.text.trim()) && session.step) {
      sessionStore.clearSession(chatId);
      session = sessionStore.getSession(chatId);
    }

    // Support chat compose — matn + media (ads dan oldin)
    if (await handleAdminSupportMessage(bot, chatId, msg, session)) return;
    if (msg.text && (await handleFactoryResetMessage(bot, chatId, msg, session))) return;

    if (session.step === "admin:ads:await") {
      const adminRecord = await prisma.admin.upsert({
        where: { telegramId: BigInt(telegramId) },
        update: {},
        create: { telegramId: BigInt(telegramId), fullName: msg.from.first_name },
      });

      const hasContent =
        msg.text ||
        msg.photo ||
        msg.video ||
        msg.video_note ||
        msg.voice ||
        msg.audio ||
        msg.animation ||
        msg.sticker ||
        msg.document ||
        msg.contact ||
        msg.location;

      if (!hasContent) {
        await bot.sendMessage(chatId, "❗️ Matn yoki media yuboring (rasm, video, ovoz va hokazo).");
        return;
      }

      const progressMsg = await bot.sendMessage(chatId, "📢 Yuborish boshlandi... 0%");
      try {
        const result = await broadcastService.broadcast(bot, msg, adminRecord.id, async ({ pct, success, failed, total, done }) => {
          try {
            await bot.editMessageText(
              `📢 Yuborilmoqda... ${pct}%\n✅ ${success} | ❌ ${failed} | Jami ${total} (${done}/${total})`,
              { chat_id: chatId, message_id: progressMsg.message_id }
            );
          } catch (_) {}
        });
        sessionStore.clearSession(chatId);
        await bot.sendMessage(
          chatId,
          `📢 <b>Yakuniy hisobot</b>\n\n` +
            `Tur: ${result.mediaType}\n` +
            `Jami: ${result.total}\n` +
            `✅ Muvaffaqiyatli: ${result.success}\n` +
            `❌ Xatolik: ${result.failed}`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        sessionStore.clearSession(chatId);
        await bot.sendMessage(chatId, `❌ Reklama yuborishda xatolik: ${err.message}`);
      }
      return;
    }

    if (!msg.text) return;

    if (await handlePricingAdminMessage(bot, chatId, msg, session)) return;
    if (await handleCourierAdminMessage(bot, chatId, msg, session)) return;
    if (await handleCrmAdminMessage(bot, chatId, msg, session)) return;

    if (session.step === "admin:inv:set") {
      // Legacy path — redirect to unit-based inventory
      sessionStore.clearSession(chatId);
      await bot.sendMessage(
        chatId,
        "ℹ️ Sonni qo'lda o'zgartirish o'chirilgan.\nModelni tanlab «➕ Qurilma qo'shish» dan foydalaning."
      );
      await adminInventory.sendOverview(bot, chatId);
      return;
    }

    if (session.step === "admin:settings:delivery") {
      try {
        const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
        const fee = await settingsService.setDeliveryFee(msg.text.trim(), {
          telegramId,
          adminId: adminRecord?.id,
        });
        sessionStore.clearSession(chatId);
        await bot.sendMessage(chatId, `✅ Yetkazib berish narxi: ${fee.toLocaleString()} so'm`);
      } catch (err) {
        await bot.sendMessage(chatId, `❌ ${err.message}`);
      }
      return;
    }

    // ---- Promo-kod yaratish jarayoni ----
    if (session.step === "admin:promo:code") {
      try {
        const code = promoService.normalizeCode(msg.text);
        if (!code || code.length < 2) throw new Error("Kod kamida 2 belgi bo'lishi kerak");
        sessionStore.updateData(chatId, { _code: code });
        sessionStore.setStep(chatId, "admin:promo:discount");
        await bot.sendMessage(chatId, "Chegirma foizini kiriting (1–100, masalan 15):");
      } catch (err) {
        await bot.sendMessage(chatId, `❗️ ${err.message}`);
      }
      return;
    }
    if (session.step === "admin:promo:discount") {
      const discount = Number(msg.text.trim());
      if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
        await bot.sendMessage(chatId, "❗️ Foiz 1–100 oralig'ida bo'lishi kerak. Qayta kiriting:");
        return;
      }
      sessionStore.updateData(chatId, { _discount: discount });
      sessionStore.setStep(chatId, "admin:promo:limit");
      await bot.sendMessage(chatId, "Umumiy foydalanish limitini kiriting (masalan 100):");
      return;
    }
    if (session.step === "admin:promo:limit") {
      const limit = Number(msg.text.trim());
      if (!Number.isInteger(limit) || limit <= 0) {
        await bot.sendMessage(chatId, "❗️ Limit musbat butun son bo'lishi kerak. Qayta kiriting:");
        return;
      }
      sessionStore.updateData(chatId, { _limit: limit });
      sessionStore.setStep(chatId, "admin:promo:perUser");
      await bot.sendMessage(chatId, "Bitta foydalanuvchi necha marta ishlata oladi? (masalan 1):");
      return;
    }
    if (session.step === "admin:promo:perUser") {
      const perUser = Number(msg.text.trim());
      if (!Number.isInteger(perUser) || perUser < 1) {
        await bot.sendMessage(chatId, "❗️ Per-user limit 1 yoki undan katta bo'lishi kerak:");
        return;
      }
      sessionStore.updateData(chatId, { _perUser: perUser });
      sessionStore.setStep(chatId, "admin:promo:days");
      await bot.sendMessage(chatId, "Necha kun amal qilishini kiriting (masalan 30):");
      return;
    }
    if (session.step === "admin:promo:days") {
      const days = Number(msg.text.trim());
      if (!Number.isInteger(days) || days <= 0) {
        await bot.sendMessage(chatId, "❗️ Kunlar soni musbat butun son bo'lishi kerak:");
        return;
      }
      const { _code, _discount, _limit, _perUser } = session.data;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      try {
        const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
        const promo = await promoService.createPromo(
          {
            code: _code,
            discountType: "PERCENT",
            discountPercent: _discount,
            usageLimit: _limit,
            perUserLimit: _perUser || 1,
            expiresAt,
          },
          { telegramId, adminId: adminRecord?.id }
        );
        sessionStore.clearSession(chatId);
        await bot.sendMessage(
          chatId,
          `✅ Promo-kod yaratildi:\n\n` +
            `<b>${escapeHtml(promo.code)}</b>\n` +
            `Chegirma: -${promo.discountPercent}%\n` +
            `Limit: ${promo.usageLimit} | Per-user: ${promo.perUserLimit}\n` +
            `Muddat: ${days} kun`,
          { parse_mode: "HTML", ...promoListKeyboard(await promoService.listPromos()) }
        );
      } catch (err) {
        await bot.sendMessage(chatId, `❗️ ${err.message}`);
      }
      return;
    }
    if (session.step === "admin:promo:editLimitValue") {
      const limit = Number(msg.text.trim());
      if (!Number.isInteger(limit) || limit <= 0) {
        await bot.sendMessage(chatId, "❗️ Limit musbat butun son bo'lishi kerak:");
        return;
      }
      try {
        const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
        const promo = await promoService.updatePromo(
          session.data._promoId,
          { usageLimit: limit },
          { telegramId, adminId: adminRecord?.id }
        );
        sessionStore.clearSession(chatId);
        await bot.sendMessage(chatId, `✅ ${promo.code} limiti yangilandi: ${limit}`);
      } catch (err) {
        await bot.sendMessage(chatId, `❗️ ${err.message}`);
      }
      return;
    }

    switch (msg.text) {
      case "📊 Dashboard": {
        const [stats, alertSection] = await Promise.all([
          dashboardKpiService.getKpiStats(),
          adminAlertService.formatDashboardAlertsSection(),
        ]);
        const text =
          alertSection + "\n\n" + dashboardKpiService.formatKpiDashboard(stats);
        const sent = await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
        if (await realtimeDashboardService.isEnabled(telegramId)) {
          realtimeDashboardService.subscribe(chatId, sent.message_id);
        }
        return;
      }
      case "👥 CRM": {
        await showCrmMenu(bot, chatId);
        return;
      }
      case "💾 Backup": {
        await bot.sendMessage(chatId, "💾 <b>Backup va audit</b>", {
          parse_mode: "HTML",
          ...backupKeyboard(),
        });
        return;
      }
      case "🏷️ Promo":
      case "🏷️ Promo-kodlar": {
        const promos = await promoService.listPromos();
        const lines = promos.length ? promos.map(promoService.formatPromoLine).join("\n") : "Promo-kodlar yo'q.";
        await bot.sendMessage(chatId, `🏷️ <b>Promo-kodlar</b>\n\n${lines}`, {
          parse_mode: "HTML",
          ...promoListKeyboard(promos),
        });
        return;
      }
      case "📅 Bugun": {
        const stats = await dashboardService.getDashboardStats();
        await bot.sendMessage(chatId, dashboardService.formatTodayBlock(stats), { parse_mode: "HTML" });
        return;
      }
      case "📊 Statistika": {
        const stats = await reportService.generalStats();
        const statusLines = stats.ordersByStatus.map((s) => `  • ${label(s.status)}: ${s.count}`).join("\n");
        await bot.sendMessage(
          chatId,
          `📊 <b>Umumiy statistika</b>\n\n` +
            `👥 Foydalanuvchilar: ${stats.totalUsers}\n` +
            `🚚 Kuryerlar: ${stats.totalCouriers}\n` +
            `🎮 PlayStationlar: ${stats.totalPlaystations}\n` +
            `📦 Jami buyurtmalar: ${stats.totalOrders}\n` +
            `💰 Jami daromad: ${stats.totalRevenue.toLocaleString()} so'm\n\n` +
            `Statuslar bo'yicha:\n${statusLines}`,
          { parse_mode: "HTML" }
        );
        return;
      }
      case "📦 Buyurtmalar": {
        await bot.sendMessage(chatId, "Status bo'yicha filter:", adminKeyboards.orderStatusFilterKeyboard());
        return;
      }
      case "🎮 Inventar":
      case "🎮 PlayStationlar": {
        await adminInventory.sendOverview(bot, chatId);
        await bot.sendMessage(
          chatId,
          "📦 Professional inventar (Joystick / HDMI / Power):",
          adminInventoryItem.typeKeyboard()
        );
        return;
      }
      case "📈 Analytics": {
        try {
          await showAnalytics(bot, chatId, "today");
        } catch (err) {
          // showAnalytics allaqachon xabar yuborgan bo'lishi mumkin
        }
        return;
      }
      case "📋 Loglar": {
        const payload = await auditLogService.buildTelegramList(15);
        await bot.sendMessage(chatId, payload.text, payload.options);
        return;
      }
      case "⚙️ Sozlamalar": {
        const [fee, maintenanceOn, realtimeOn] = await Promise.all([
          settingsService.getDeliveryFee(),
          maintenanceService.isEnabled(),
          realtimeDashboardService.isEnabled(telegramId),
        ]);
        await bot.sendMessage(
          chatId,
          `⚙️ <b>Sozlamalar</b>\n\n🚚 Yetkazib berish: <b>${fee.toLocaleString()} so'm</b>\n🚧 Maintenance: <b>${maintenanceOn ? "YOQILGAN" : "O'CHIRILGAN"}</b>\n🔄 Real-time: <b>${realtimeOn ? "YOQILGAN" : "O'CHIRILGAN"}</b>`,
          { parse_mode: "HTML", ...adminKeyboards.settingsKeyboard({ maintenanceOn, realtimeOn }) }
        );
        return;
      }
      case "👥 Foydalanuvchilar": {
        const users = await userService.listUsers({ take: 15 });
        const lines = users.map((u) => `• ${u.fullName || "—"} (${u.phone || "tel yo'q"}) ${u.isBlocked ? "🚫" : ""}`);
        await bot.sendMessage(chatId, lines.join("\n") || "Foydalanuvchilar topilmadi.");
        return;
      }
      case "🚚 Kuryerlar": {
        const top = await courierStatsService.getTopCouriers(5);
        await bot.sendMessage(chatId, courierStatsService.formatTopCouriers(top), { parse_mode: "HTML" });
        await bot.sendMessage(chatId, "🚚 Kuryerlar boshqaruvi:", courierAdminMenuKeyboard());
        return;
      }
      case "📢 Reklama": {
        sessionStore.setStep(chatId, "admin:ads:await");
        await bot.sendMessage(
          chatId,
          "📢 <b>Reklama yuborish</b>\n\nMatn, rasm, video, ovoz, sticker, hujjat, kontakt yoki lokatsiya yuboring.\nCaption va inline tugmalar saqlanadi.",
          { parse_mode: "HTML" }
        );
        return;
      }
      case "💰 Narxlar": {
        await bot.sendMessage(chatId, "💰 Narxlar boshqaruvi:", adminPricingKeyboards.pricingMenuKeyboard());
        return;
      }
      case "🗑 Bazani tozalash": {
        if (!factoryResetService.isSuperAdmin(telegramId)) {
          await bot.sendMessage(chatId, "❗️ Bu amal faqat Super Admin uchun.");
          return;
        }
        await startFactoryResetFlow(bot, chatId, telegramId);
        return;
      }
      default:
        return;
    }
  });

  addCallbackHandler("admin-main", async (bot, query) => {
    const data = query.data;
    if (!isAdminMainCallback(data)) return false;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;

    await safeAnswerCallbackQuery(bot, query.id);

    if (!(await isAdmin(telegramId))) {
      await bot.sendMessage(chatId, "Ruxsat yo'q.");
      return true;
    }

    if (await adminInventoryItem.handleCallback(bot, query, data)) return true;
    if (await adminInventory.handleCallback(bot, query, data, { telegramId })) return true;

    if (data === "admin:promo:new") {
      sessionStore.setStep(chatId, "admin:promo:code");
      await bot.sendMessage(chatId, "Yangi promo-kod matnini kiriting (masalan SUMMER2026):");
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data === "admin:promo:list") {
      const promos = await promoService.listPromos();
      const lines = promos.length ? promos.map(promoService.formatPromoLine).join("\n") : "Promo-kodlar yo'q.";
      await bot.sendMessage(chatId, `🏷️ <b>Promo-kodlar</b>\n\n${lines}`, {
        parse_mode: "HTML",
        ...promoListKeyboard(promos),
      });
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data.startsWith("admin:promo:view:")) {
      const id = Number(data.split(":")[3]);
      const promo = await prisma.promocode.findUnique({ where: { id } });
      if (!promo) {
        await bot.sendMessage(chatId, "Topilmadi");
        return true;
      }
      await bot.sendMessage(chatId, promoService.formatPromoDetails(promo), {
        parse_mode: "HTML",
        ...promoActionKeyboard(promo.id, promo.isActive),
      });
      return true;
    }

    if (data.startsWith("admin:promo:toggle:")) {
      const id = Number(data.split(":")[3]);
      const promo = await prisma.promocode.findUnique({ where: { id } });
      if (!promo) {
        await bot.sendMessage(chatId, "Topilmadi");
        return true;
      }
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      const updated = await promoService.togglePromo(id, !promo.isActive, {
        telegramId,
        adminId: adminRecord?.id,
      });
      await bot.sendMessage(
        chatId,
        `✅ ${updated.code} endi ${updated.isActive ? "faol" : "nofaol"}.`,
        promoActionKeyboard(updated.id, updated.isActive)
      );
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data.startsWith("admin:promo:editLimit:")) {
      const id = Number(data.split(":")[3]);
      sessionStore.updateData(chatId, { _promoId: id });
      sessionStore.setStep(chatId, "admin:promo:editLimitValue");
      await bot.sendMessage(chatId, "Yangi umumiy foydalanish limitini kiriting:");
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data.startsWith("admin:promo:delete:")) {
      const id = Number(data.split(":")[3]);
      try {
        const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
        const deleted = await promoService.deletePromo(id, { telegramId, adminId: adminRecord?.id });
        await bot.sendMessage(chatId, `🗑 Promo o'chirildi: ${deleted.code}`);
        const promos = await promoService.listPromos();
        await bot.sendMessage(
          chatId,
          `🏷️ <b>Promo-kodlar</b>\n\n${promos.map(promoService.formatPromoLine).join("\n") || "Bo'sh"}`,
          { parse_mode: "HTML", ...promoListKeyboard(promos) }
        );
      } catch (err) {
        await bot.sendMessage(chatId, `❗️ ${err.message}`);
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data.startsWith("admin:ext:")) {
      const [, , action, extIdRaw] = data.split(":");
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      const ctx = { telegramId, adminId: adminRecord?.id };
      try {
        if (action === "approve") {
          await rentalExtensionService.approveExtension(Number(extIdRaw), ctx);
          await bot.sendMessage(chatId, "✅ Uzaytirish tasdiqlandi.");
        } else if (action === "reject") {
          await rentalExtensionService.rejectExtension(Number(extIdRaw), ctx);
          await bot.sendMessage(chatId, "❌ Uzaytirish rad etildi.");
        }
      } catch (err) {
        await bot.sendMessage(chatId, `❌ ${err.message}`);
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data === "admin:settings:realtime") {
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      const ctx = { telegramId, adminId: adminRecord?.id };
      const enabled = await realtimeDashboardService.toggle(telegramId, ctx);
      if (enabled) {
        const [stats, alertSection] = await Promise.all([
          dashboardKpiService.getKpiStats(),
          adminAlertService.formatDashboardAlertsSection(),
        ]);
        const text =
          alertSection + "\n\n" + dashboardKpiService.formatKpiDashboard(stats);
        const sent = await bot.sendMessage(chatId, text + "\n\n<i>🔄 Real-time yoqildi</i>", { parse_mode: "HTML" });
        realtimeDashboardService.subscribe(chatId, sent.message_id);
        await bot.sendMessage(chatId, "✅ Real-time dashboard yoqildi.");
      } else {
        await bot.sendMessage(chatId, "✅ Real-time dashboard o'chirildi.");
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data === "admin:dashboard:unsubscribe") {
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      await realtimeDashboardService.setEnabled(telegramId, false, { telegramId, adminId: adminRecord?.id });
      await bot.sendMessage(chatId, "Real-time dashboard o'chirildi.");
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data === "admin:settings:maintenance") {
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      const current = await maintenanceService.isEnabled();
      await maintenanceService.setEnabled(!current, { telegramId, adminId: adminRecord?.id });
      await bot.sendMessage(chatId, current ? "✅ Maintenance o'chirildi." : "🚧 Maintenance yoqildi.");
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data.startsWith("admin:orders:filter:")) {
      const filterKey = data.split(":")[3];
      const group = filterGroup(filterKey);
      const orders = await orderService.listOrdersByFilter(filterKey, { take: 10 });
      const title = group?.label || (filterKey === "ALL" ? "Barchasi" : filterKey);
      if (orders.length === 0) {
        await bot.sendMessage(chatId, `"${title}" bo'yicha buyurtmalar yo'q.`);
      } else {
        for (const o of orders) {
          await bot.sendMessage(
            chatId,
            `#${o.id} — ${o.consoleType} — ${label(o.status)}\nMijoz: ${o.user?.fullName || "—"}`,
            {
              reply_markup: {
                inline_keyboard: [[{ text: "📜 Timeline", callback_data: `admin:order:timeline:${o.id}` }]],
              },
            }
          );
        }
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data.startsWith("admin:order:timeline:")) {
      const orderId = Number(data.split(":")[3]);
      const order = await orderService.getOrderById(orderId);
      if (order) {
        await bot.sendMessage(chatId, buildOrderTimeline(order), { parse_mode: "HTML" });
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (data === "admin:settings:delivery") {
      sessionStore.setStep(chatId, "admin:settings:delivery");
      const fee = await settingsService.getDeliveryFee();
      await bot.sendMessage(chatId, `Hozirgi narx: ${fee.toLocaleString()} so'm.\nYangi narxni kiriting:`);
      await safeAnswerCallbackQuery(bot, query.id);
      return true;
    }

    if (!data.startsWith("admin:orders:")) return false;
    const status = data.split(":")[2];
    const orders = await orderService.listOrdersByStatus(status, { take: 15 });
    const lines = orders.map(
      (o) => `#${o.id} — ${o.consoleType}, mijoz: ${o.user.fullName || o.user.telegramId}, status: ${label(o.status)}`
    );
    await bot.sendMessage(chatId, lines.join("\n") || `"${label(status)}" statusida buyurtmalar yo'q.`);
    await safeAnswerCallbackQuery(bot, query.id);
    return true;
  });

}

module.exports = { register, isAdmin, isSuperAdmin: factoryResetService.isSuperAdmin };
