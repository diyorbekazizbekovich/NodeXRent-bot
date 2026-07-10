const { rateLimiter, buildBlockMessage } = require("../../services/rateLimiter.service");
const logger = require("../../utils/logger");
const { t, resolveLang } = require("../../i18n");
const env = require("../../config/env");
const prisma = require("../../config/prisma");

/**
 * Telegram update dan foydalanuvchi id sini oladi.
 */
function extractUserId(update) {
  if (update.callback_query?.from?.id) return update.callback_query.from.id;
  if (update.message?.from?.id) return update.message.from.id;
  if (update.edited_message?.from?.id) return update.edited_message.from.id;
  if (update.inline_query?.from?.id) return update.inline_query.from.id;
  return null;
}

const langCache = new Map();
/** @type {Map<number|string, { role: 'ADMIN'|'COURIER'|'CLIENT', expiresAt: number }>} */
const roleCache = new Map();
const ROLE_CACHE_TTL_MS = 60_000;

async function resolveUserLang(telegramId) {
  if (langCache.has(telegramId)) return langCache.get(telegramId);
  try {
    const userService = require("../../services/user.service");
    const user = await userService.getUserByTelegramId(telegramId);
    const L = resolveLang(user?.language);
    langCache.set(telegramId, L);
    setTimeout(() => langCache.delete(telegramId), 60_000);
    return L;
  } catch (_) {
    return resolveLang(null);
  }
}

/**
 * Rolni DB / env orqali aniqlaydi.
 * ADMIN va COURIER rate limitdan to'liq ozod.
 * @returns {Promise<'ADMIN'|'COURIER'|'CLIENT'>}
 */
async function resolveBotRole(telegramId) {
  const key = String(telegramId);
  const cached = roleCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.role;
  }

  let role = "CLIENT";
  try {
    if (env.ADMIN_TELEGRAM_IDS.includes(Number(telegramId))) {
      role = "ADMIN";
    } else {
      const admin = await prisma.admin.findUnique({
        where: { telegramId: BigInt(telegramId) },
        select: { id: true },
      });
      if (admin) {
        role = "ADMIN";
      } else {
        const courier = await prisma.courier.findUnique({
          where: { telegramId: BigInt(telegramId) },
          select: { id: true },
        });
        if (courier) role = "COURIER";
      }
    }
  } catch (err) {
    logger.warn("Rate limit rol aniqlash xatoligi — CLIENT deb hisoblanadi", {
      error: err.message,
      telegramId: String(telegramId),
    });
    role = "CLIENT";
  }

  roleCache.set(key, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
  return role;
}

function isPrivilegedRole(role) {
  return role === "ADMIN" || role === "COURIER";
}

/**
 * processUpdate ni o'rab, barcha handlerlardan OLDIN rate limit tekshiradi.
 * ADMIN / COURIER — butunlay o'tkazib yuboriladi.
 * CLIENT — mavjud anti-spam logikasi.
 */
function applyRateLimitMiddleware(bot) {
  const originalProcessUpdate = bot.processUpdate.bind(bot);

  bot.processUpdate = function rateLimitedProcessUpdate(update) {
    const userId = extractUserId(update);

    if (userId == null) {
      return originalProcessUpdate(update);
    }

    // Rol async — privileged bo'lsa limiterga umuman kirmaydi
    resolveBotRole(userId)
      .then((role) => {
        if (isPrivilegedRole(role)) {
          return originalProcessUpdate(update);
        }

        try {
          const result = rateLimiter.check(userId);

          if (!result.allowed) {
            if (result.shouldNotify) {
              const chatId =
                update.callback_query?.message?.chat?.id ||
                update.message?.chat?.id ||
                userId;
              resolveUserLang(userId).then((L) => {
                const text = buildBlockMessage(result.remainingMs, L);
                bot.sendMessage(chatId, text).catch((err) => {
                  logger.warn("Rate limit xabar yuborilmadi", { error: err.message, userId });
                });
              });
            }

            if (update.callback_query?.id) {
              resolveUserLang(userId).then((L) => {
                bot
                  .answerCallbackQuery(update.callback_query.id, {
                    text: t("rateLimit.callback", L),
                    show_alert: false,
                  })
                  .catch(() => {});
              });
            }
            return;
          }
        } catch (err) {
          logger.error("Rate limit middleware xatoligi", { error: err.message });
        }

        return originalProcessUpdate(update);
      })
      .catch((err) => {
        logger.error("Rate limit role resolve xatoligi", { error: err.message });
        // Fail-open: rol aniqlanmasa ham bot ishlasin (CLIENT sifatida limitley olmaymiz — xavfsizroq fail-open)
        return originalProcessUpdate(update);
      });
  };
}

module.exports = {
  applyRateLimitMiddleware,
  extractUserId,
  resolveBotRole,
  isPrivilegedRole,
};
