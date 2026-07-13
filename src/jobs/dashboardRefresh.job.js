const dashboardKpiService = require("../services/dashboardKpi.service");
const adminAlertService = require("../services/adminAlert.service");
const realtimeDashboardService = require("../services/realtimeDashboard.service");
const logger = require("../utils/logger");
const { startOnce } = require("./jobGuard");

function startDashboardRefreshJob(bot, intervalMs = 30000) {
  startOnce("dashboardRefresh", () => {
    const timer = setInterval(async () => {
      const subs = require("../stores/dashboardSubscriptionStore").getAll();
      if (subs.size === 0) return;

      try {
        const body =
          (await adminAlertService.formatDashboardAlertsSection()) +
          "\n\n" +
          dashboardKpiService.formatKpiDashboard(await dashboardKpiService.getKpiStats()) +
          "\n\n<i>🔄 Real-time (avto-yangilanish)</i>";

        for (const [chatId, { messageId }] of subs.entries()) {
          const enabled = await realtimeDashboardService.isEnabled(chatId);
          if (!enabled) {
            require("../stores/dashboardSubscriptionStore").unsubscribe(chatId);
            continue;
          }

          try {
            await bot.editMessageText(body, {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "HTML",
            });
          } catch (err) {
            if (err.message?.includes("message is not modified")) continue;
            logger.warn("Dashboard refresh edit failed", {
              chatId,
              error: err.message,
            });
            require("../stores/dashboardSubscriptionStore").unsubscribe(chatId);
          }
        }
      } catch (err) {
        logger.warn("Dashboard refresh xatoligi", { error: err.message });
      }
    }, intervalMs);

    if (typeof timer.unref === "function") timer.unref();
  });
}

module.exports = { startDashboardRefreshJob };
