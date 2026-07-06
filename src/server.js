const env = require("./config/env");
const logger = require("./utils/logger");
const prisma = require("./config/prisma");
const { createBot } = require("./bot");
const { createApp } = require("./app");

const { startReminderJob } = require("./jobs/reminder.job");
const { startAutoExpireJob } = require("./jobs/autoExpire.job");
const { startCourierTimeoutJob } = require("./jobs/courierTimeout.job");
const { startDailyReportJob } = require("./jobs/dailyReport.job");
const { startDashboardRefreshJob } = require("./jobs/dashboardRefresh.job");

async function main() {
  // DB ulanishini tekshirish
  await prisma.$connect();
  logger.info("PostgreSQL bilan ulanish muvaffaqiyatli", { context: "Server" });

  // Botni ishga tushirish
  const bot = createBot();

  // Express serverni ishga tushirish (webhook + REST API + health-check uchun)
  const app = createApp(bot);
  app.listen(env.PORT, () => {
    logger.info(`Express server ${env.PORT}-portda ishga tushdi`, { context: "Server" });
  });

  // Fon vazifalarni (cron) ishga tushirish
  startReminderJob();
  startAutoExpireJob();
  startCourierTimeoutJob();
  startDailyReportJob();
  startDashboardRefreshJob(bot);

  logger.info("Barcha cron job'lar ishga tushirildi", { context: "Server" });
}

main().catch((err) => {
  logger.error("Ilovani ishga tushirishda xatolik", { context: "Server", error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    context: "Server",
    error: reason?.message || String(reason),
  });
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
