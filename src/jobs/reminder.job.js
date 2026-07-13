const cron = require("node-cron");
const logger = require("../utils/logger");
const reminderService = require("../services/reminder.service");
const { startOnce } = require("./jobGuard");

/**
 * Har daqiqada: 6h confirm-ready, 3/2/1h user, 2h priority, return reminders.
 * Idempotent — OrderReminderLog orqali qayta yuborilmaydi.
 */
function startReminderJob() {
  startOnce("reminder", () => {
    cron.schedule("* * * * *", async () => {
      try {
        await reminderService.processAllReminders(new Date());
      } catch (err) {
        logger.error("ReminderJob xatoligi", { context: "ReminderJob", error: err.message });
      }
    });
  });
}

module.exports = { startReminderJob };
