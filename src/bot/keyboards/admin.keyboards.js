function mainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ["📊 Dashboard", "📅 Bugun"],
        ["👥 CRM", "📦 Buyurtmalar"],
        ["🎮 Inventar", "📈 Analytics"],
        ["🚚 Kuryerlar", "💰 Narxlar"],
        ["💾 Backup", "📋 Loglar"],
        ["🏷️ Promo", "📢 Reklama", "⚙️ Sozlamalar"],
      ],
      resize_keyboard: true,
    },
  };
}

function inventoryTypeKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "PS3 +", callback_data: "admin:inv:PS3:inc" },
          { text: "PS3 −", callback_data: "admin:inv:PS3:dec" },
          { text: "PS3 soni", callback_data: "admin:inv:PS3:set" },
        ],
        [
          { text: "PS4 +", callback_data: "admin:inv:PS4:inc" },
          { text: "PS4 −", callback_data: "admin:inv:PS4:dec" },
          { text: "PS4 soni", callback_data: "admin:inv:PS4:set" },
        ],
        [
          { text: "PS5 +", callback_data: "admin:inv:PS5:inc" },
          { text: "PS5 −", callback_data: "admin:inv:PS5:dec" },
          { text: "PS5 soni", callback_data: "admin:inv:PS5:set" },
        ],
        [{ text: "📋 Qurilmalar", callback_data: "admin:inv:units" }],
        [{ text: "🔄 Yangilash", callback_data: "admin:inv:refresh" }],
      ],
    },
  };
}

function orderStatusFilterKeyboard() {
  const { ADMIN_FILTER_GROUPS } = require("../../constants/orderStatus");
  const rows = ADMIN_FILTER_GROUPS.map((g) => [
    { text: g.label, callback_data: `admin:orders:filter:${g.key}` },
  ]);
  rows.push([{ text: "📋 Barchasi", callback_data: "admin:orders:filter:ALL" }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function settingsKeyboard({ maintenanceOn = false, realtimeOn = true } = {}) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚚 Yetkazib berish narxi", callback_data: "admin:settings:delivery" }],
        [
          {
            text: maintenanceOn ? "✅ Maintenance OFF" : "🚧 Maintenance ON",
            callback_data: "admin:settings:maintenance",
          },
        ],
        [
          {
            text: realtimeOn ? "🔄 Real-time OFF" : "🔄 Real-time ON",
            callback_data: "admin:settings:realtime",
          },
        ],
      ],
    },
  };
}

module.exports = {
  mainMenuKeyboard,
  inventoryTypeKeyboard,
  orderStatusFilterKeyboard,
  settingsKeyboard,
};
