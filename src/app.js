const express = require("express");
const env = require("./config/env");
const logger = require("./utils/logger");
const adminRoutes = require("./api/routes/admin.routes");
const pricingRoutes = require("./api/routes/pricing.routes");
const adminPricingRoutes = require("./api/routes/admin.pricing.routes");

// Prisma BigInt (telegramId) maydonlarini JSON.stringify to'g'ri serializatsiya qilishi uchun
BigInt.prototype.toJSON = function () {
  return this.toString();
};

function createApp(bot) {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/admin", adminRoutes);
  app.use("/api/pricing", pricingRoutes);
  app.use("/api/admin/pricing", adminPricingRoutes);

  // Telegram webhook rejimi uchun endpoint (agar BOT_MODE=webhook bo'lsa)
  if (env.BOT_MODE === "webhook" && bot) {
    app.post(`/webhook/${env.BOT_TOKEN}`, (req, res) => {
      const secretHeader = req.header("X-Telegram-Bot-Api-Secret-Token");
      if (env.WEBHOOK_SECRET && secretHeader !== env.WEBHOOK_SECRET) {
        return res.sendStatus(401);
      }
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
  }

  // Global xatoliklarni ushlash
  app.use((err, req, res, next) => {
    logger.error("Express xatoligi", { context: "App", error: err.message });
    res.status(500).json({ error: "Ichki server xatoligi" });
  });

  return app;
}

module.exports = { createApp };
