const { PERIODS } = require("../../services/analytics.service");

function analyticsPeriodKeyboard(activePeriod = PERIODS.today) {
  const mark = (period, label) => (period === activePeriod ? `• ${label}` : label);
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: mark(PERIODS.today, "📅 Bugun"), callback_data: "admin:analytics:period:today" },
          { text: mark(PERIODS.week, "📆 Hafta"), callback_data: "admin:analytics:period:week" },
        ],
        [
          { text: mark(PERIODS.month, "🗓 Oy"), callback_data: "admin:analytics:period:month" },
          { text: mark(PERIODS.all, "♾ Umumiy"), callback_data: "admin:analytics:period:all" },
        ],
        [
          { text: "🔄 Yangilash", callback_data: `admin:analytics:refresh:${activePeriod}` },
          { text: "⬅️ Orqaga", callback_data: "admin:analytics:back" },
        ],
      ],
    },
  };
}

module.exports = { analyticsPeriodKeyboard };
