const crypto = require("crypto");
const prisma = require("../config/prisma");
const env = require("../config/env");
const logger = require("../utils/logger");
const auditLogService = require("./auditLog.service");

const CONFIRM_PHRASE = "DELETE ALL DATA";

/** Bir vaqtda faqat bitta factory reset */
let resetInProgress = false;

class FactoryResetError extends Error {
  constructor(message, code = "FACTORY_RESET_ERROR") {
    super(message);
    this.code = code;
  }
}

function isSuperAdmin(telegramId) {
  const id = Number(telegramId);
  if (!Number.isFinite(id)) return false;
  if (env.SUPER_ADMIN_TELEGRAM_IDS.length) {
    return env.SUPER_ADMIN_TELEGRAM_IDS.includes(id);
  }
  // SUPER_ADMIN_TELEGRAM_IDS bo'sh bo'lsa — faqat birinchi ADMIN_TELEGRAM_IDS
  return env.ADMIN_TELEGRAM_IDS[0] === id;
}

function createResetToken() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Biznes ma'lumotlarini tozalash.
 * Saqlanadi: Super Admin (Admin + User), katalog/narxlar, zonalar, sozlamalar,
 * inventar qurilmalari (status AVAILABLE ga), kuryer akkauntlari.
 */
async function executeFactoryReset({ telegramId, adminId } = {}) {
  if (!isSuperAdmin(telegramId)) {
    throw new FactoryResetError("Faqat Super Admin bajarishi mumkin.", "FORBIDDEN");
  }
  if (resetInProgress) {
    throw new FactoryResetError("Factory Reset allaqachon bajarilmoqda.", "BUSY");
  }

  resetInProgress = true;
  const startedAt = Date.now();

  try {
    const preserveTelegramIds = env.SUPER_ADMIN_TELEGRAM_IDS.length
      ? env.SUPER_ADMIN_TELEGRAM_IDS
      : env.ADMIN_TELEGRAM_IDS.slice(0, 1);

    const preserveBigInts = preserveTelegramIds.map((id) => BigInt(id));

    const counts = await prisma.$transaction(
      async (tx) => {
        // --- Order bog'liq (explicit, cascade bo'lmasa ham) ---
        const orderPhotos = await tx.orderPhoto.deleteMany({});
        const contracts = await tx.rentalContract.deleteMany({});
        const orderItems = await tx.orderInventoryItem.deleteMany({});
        const extensions = await tx.rentalExtension.deleteMany({});
        const payments = await tx.orderPayment.deleteMany({});
        const statusLogs = await tx.orderStatusLog.deleteMany({});
        const reviews = await tx.review.deleteMany({});
        const notifications = await tx.notification.deleteMany({});
        const orders = await tx.order.deleteMany({});

        // --- Support / CRM chat ---
        const supportMessages = await tx.supportMessage.deleteMany({});
        const supportThreads = await tx.supportThread.deleteMany({});

        // --- Promo / reklama ---
        const promocodes = await tx.promocode.deleteMany({});
        const campaigns = await tx.adCampaign.deleteMany({});

        // --- Inventar tarixi + status reset ---
        const invItemHistory = await tx.inventoryItemHistory.deleteMany({});
        const invUnitHistory = await tx.inventoryUnitHistory.deleteMany({});

        const invItemsReset = await tx.inventoryItem.updateMany({
          data: {
            status: "AVAILABLE",
            reservedOrderId: null,
            note: null,
          },
        });
        const invUnitsReset = await tx.inventoryUnit.updateMany({
          data: { status: "AVAILABLE" },
        });
        const playstationsReset = await tx.playstation.updateMany({
          data: { status: "AVAILABLE" },
        });

        // --- Foydalanuvchilar (super admin telegram ID saqlanadi) ---
        const users = await tx.user.deleteMany({
          where: {
            telegramId: { notIn: preserveBigInts },
          },
        });

        // --- Audit / backup meta ---
        const auditLogs = await tx.adminAuditLog.deleteMany({});
        const backups = await tx.databaseBackup.deleteMany({});

        // Super admin User qatorini yumshoq tozalash (CRM izohlari)
        await tx.user.updateMany({
          where: { telegramId: { in: preserveBigInts } },
          data: {
            adminNotes: null,
            customerRating: "NORMAL",
            lastActivityAt: new Date(),
          },
        });

        return {
          orders: orders.count,
          orderPhotos: orderPhotos.count,
          contracts: contracts.count,
          orderItems: orderItems.count,
          extensions: extensions.count,
          payments: payments.count,
          statusLogs: statusLogs.count,
          reviews: reviews.count,
          notifications: notifications.count,
          supportMessages: supportMessages.count,
          supportThreads: supportThreads.count,
          promocodes: promocodes.count,
          campaigns: campaigns.count,
          invItemHistory: invItemHistory.count,
          invUnitHistory: invUnitHistory.count,
          invItemsReset: invItemsReset.count,
          invUnitsReset: invUnitsReset.count,
          playstationsReset: playstationsReset.count,
          users: users.count,
          auditLogs: auditLogs.count,
          backups: backups.count,
        };
      },
      {
        maxWait: 15000,
        timeout: 120000,
      }
    );

    logger.warn("Factory reset completed", {
      telegramId,
      adminId,
      durationMs: Date.now() - startedAt,
      counts,
    });

    // Audit log resetdan KEYIN (jadval tozalangan)
    try {
      await auditLogService.log({
        module: "FACTORY_RESET",
        adminId: adminId || null,
        adminTelegramId: telegramId,
        action: "FACTORY_RESET_EXECUTED",
        entityType: "Database",
        entityId: 0,
        afterData: { counts, preserveTelegramIds },
      });
    } catch (err) {
      logger.warn("Factory reset audit log yozilmadi", { error: err.message });
    }

    return { counts, preserveTelegramIds, durationMs: Date.now() - startedAt };
  } finally {
    resetInProgress = false;
  }
}

function formatSuccessMessage(result) {
  const c = result.counts || {};
  return (
    "✅ Database muvaffaqiyatli tozalandi.\n\n" +
    "Barcha biznes ma'lumotlari o'chirildi.\n" +
    "Super Admin saqlab qolindi.\n\n" +
    `📦 Buyurtmalar: ${c.orders ?? 0}\n` +
    `👥 Foydalanuvchilar: ${c.users ?? 0}\n` +
    `🏷️ Promo: ${c.promocodes ?? 0}\n` +
    `💬 Support xabarlar: ${c.supportMessages ?? 0}\n` +
    `📋 Loglar: ${c.auditLogs ?? 0}\n` +
    `🎮 Inventar statuslari tiklandi: ${c.invItemsReset ?? 0}\n\n` +
    `⏱ ${result.durationMs} ms`
  );
}

module.exports = {
  CONFIRM_PHRASE,
  FactoryResetError,
  isSuperAdmin,
  createResetToken,
  executeFactoryReset,
  formatSuccessMessage,
};
