function pricingMenuKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Barcha narxlar", callback_data: "admin:pricing:list" }],
        [{ text: "✏️ Narxni tahrirlash", callback_data: "admin:pricing:edit" }],
        [{ text: "➕ Yangi muddat qo'shish", callback_data: "admin:pricing:add" }],
        [{ text: "🔛 Faol/nofaol", callback_data: "admin:pricing:toggle" }],
        [{ text: "🎮 Konsol turlari", callback_data: "admin:pricing:consoles" }],
        [{ text: "➕ Yangi konsol", callback_data: "admin:pricing:addConsole" }],
      ],
    },
  };
}

function rentalPriceSelectKeyboard(prices, action = "pick") {
  return {
    reply_markup: {
      inline_keyboard: prices.map((p) => [
        {
          text: `${p.consoleName} — ${p.duration}soat — ${Number(p.price).toLocaleString()} ${p.currency}${p.isActive ? "" : " (nofaol)"}`,
          callback_data: `admin:pricing:${action}:${p.id}`,
        },
      ]),
    },
  };
}

function consoleSelectKeyboard(consoles, prefix = "admin:pricing:console") {
  return {
    reply_markup: {
      inline_keyboard: consoles.map((c) => [
        {
          text: `${c.displayName} (${c.code})${c.isActive ? "" : " 🚫"}`,
          callback_data: `${prefix}:${c.id}`,
        },
      ]),
    },
  };
}

module.exports = { pricingMenuKeyboard, rentalPriceSelectKeyboard, consoleSelectKeyboard };
