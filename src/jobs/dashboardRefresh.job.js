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
        const [stats, alerts] = await Promise.all([
          dashboardKpiService.getKpiStats(),
          adminAlertService.getAdminAlerts(),
        ]);
        const body =
          adminAlertService.formatAlerts(alerts) +
          "\n\n" +
          dashboardKpiService.formatKpiDashboard(stats) +
          "\n\n_🔄 Real-time (avto-yangilanish)_";

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
              parse_mode: "Markdown",
            });
          } catch (err) {
            if (err.message?.includes("message is not modified")) continue;
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
