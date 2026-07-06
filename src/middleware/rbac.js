const env = require("../config/env");
const prisma = require("../config/prisma");

function parseTelegramId(req) {
  const raw = req.headers["x-telegram-id"] || req.query.telegramId;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

async function resolveAuth(telegramId) {
  if (!telegramId) return null;

  if (env.ADMIN_TELEGRAM_IDS.includes(telegramId)) {
    const admin = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
    return { role: "admin", telegramId, adminId: admin?.id ?? null };
  }

  const admin = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (admin) return { role: "admin", telegramId, adminId: admin.id };

  const courier = await prisma.courier.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (courier) return { role: "courier", telegramId, courierId: courier.id };

  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (user) return { role: "user", telegramId, userId: user.id };

  return null;
}

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const telegramId = parseTelegramId(req);
      if (!telegramId) {
        return res.status(401).json({ error: "X-telegram-id talab qilinadi" });
      }
      const auth = await resolveAuth(telegramId);
      if (!auth || !roles.includes(auth.role)) {
        return res.status(403).json({ error: "Ruxsat yo'q" });
      }
      req.auth = auth;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = { requireRole, resolveAuth };
