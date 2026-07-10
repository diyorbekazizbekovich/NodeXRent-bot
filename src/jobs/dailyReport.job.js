const cron = require("node-cron");
const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const reportService = require("../services/report.service");
const { notify } = require("../services/notification.service");
const { formatDate } = require("../utils/dateHelper");
const { startOnce } = require("./jobGuard");

/** Har kuni soat 23:00 da barcha adminlarga kunlik statistikani yuboradi */
function startDailyReportJob() {
  startOnce("dailyReport", () => {
    cron.schedule("0 23 * * *", async () => {
      try {
        const summary = await reportService.dailySummary(new Date());
        const admins = await prisma.admin.findMany();

        const text =
          `📊 <b>Kunlik hisobot — ${formatDate(summary.date)}</b>\n\n` +
          `📦 Jami buyurtmalar: ${summary.totalOrders}\n` +
          `✅ Yakunlangan: ${summary.completedOrders}\n` +
          `❌ Bekor qilingan: ${summary.cancelledOrders}\n` +
          `💰 Kunlik daromad: ${summary.revenue.toLocaleString()} so'm`;

        for (const admin of admins) {
          await notify({
            type: "ORDER_COMPLETED",
            recipientType: "admin",
            recipientTelegramId: admin.telegramId.toString(),
            recipientId: admin.id,
            text,
          });
        }

        logger.info("Kunlik hisobot yuborildi", { context: "DailyReportJob" });
      } catch (err) {
        logger.error("DailyReportJob xatoligi", { context: "DailyReportJob", error: err.message });
      }
    });
  });
}

module.exports = { startDailyReportJob };
