const backupService = require("../../services/backup.service");
const auditLogService = require("../../services/auditLog.service");
const prisma = require("../../config/prisma");
const fs = require("fs");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { addCallbackHandler } = require("../events/callbackRouter");

function backupKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💾 Backup yaratish", callback_data: "admin:backup:create" }],
        [{ text: "📋 Backup tarixi", callback_data: "admin:backup:list" }],
        [{ text: "🗑 Loglarni tozalash", callback_data: "admin:audit:clear" }],
      ],
    },
  };
}

function registerAdminBackupHandlers(bot, isAdmin) {
  addCallbackHandler("admin-backup", async (bot, query) => {
    const data = query.data;
    if (!data?.startsWith("admin:backup:") && data !== "admin:audit:clear") return false;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;

    // Ack before backup/file IO (can take many seconds)
    await safeAnswerCallbackQuery(bot, query.id);

    if (!(await isAdmin(telegramId))) {
      await bot.sendMessage(chatId, "Ruxsat yo'q.");
      return true;
    }

    const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
    const ctx = { telegramId, adminId: adminRecord?.id };

    try {
      if (data === "admin:backup:create") {
        await bot.sendMessage(chatId, "⏳ Backup yaratilmoqda...");
        const backup = await backupService.createBackup(ctx);
        await bot.sendDocument(chatId, backup.filePath, {
          caption: `✅ Backup: ${backup.filename} (${Number(backup.fileSize).toLocaleString()} bayt)`,
        });
      } else if (data === "admin:backup:list") {
        const list = await backupService.listBackups(10);
        if (!list.length) {
          await bot.sendMessage(chatId, "Backup tarixi bo'sh.");
        } else {
          const rows = list.map((b) => [
            { text: `📥 ${b.filename}`, callback_data: `admin:backup:download:${b.id}` },
          ]);
          await bot.sendMessage(chatId, "📋 *Backup tarixi*", {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: rows },
          });
        }
      } else if (data.startsWith("admin:backup:download:")) {
        const id = Number(data.split(":")[3]);
        const backup = await backupService.getBackupFile(id);
        if (!backup) {
          await bot.sendMessage(chatId, "Backup topilmadi.");
        } else {
          await bot.sendDocument(chatId, backup.filePath, { caption: backup.filename });
        }
      } else if (data === "admin:audit:clear") {
        const count = await auditLogService.clearAll(ctx);
        await bot.sendMessage(chatId, `✅ ${count} ta log o'chirildi.`);
      }
    } catch (err) {
      await bot.sendMessage(chatId, `❌ ${err.message}`);
    }
    return true;
  });
}

module.exports = { registerAdminBackupHandlers, backupKeyboard };
