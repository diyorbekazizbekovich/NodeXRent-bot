const pricingService = require("../../services/pricing.service");

function durationIcon(hours) {
  if (hours === 24) return "🕒";
  if (hours === 48) return "🕑";
  return "⏱";
}

function mainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ["🎮 Buyurtma berish", "📋 Buyurtmalarim"],
        ["⏳ Ijara uzaytirish", "📍 Manzilni o'zgartirish"],
        ["ℹ️ Yordam"],
      ],
      resize_keyboard: true,
    },
  };
}

function contactRequestKeyboard() {
  return {
    reply_markup: {
      keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

function locationRequestKeyboard() {
  return {
    reply_markup: {
      keyboard: [[{ text: "📍 Lokatsiyani yuborish", request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

/** Bazadan faol konsol turlari bo'yicha dinamik tugmalar */
function consoleTypeKeyboard(consoles) {
  const rows = [];
  for (let i = 0; i < consoles.length; i += 2) {
    rows.push(
      consoles.slice(i, i + 2).map((c) => ({
        text: c.displayName,
        callback_data: `console:${c.code}`,
      }))
    );
  }
  return { reply_markup: { inline_keyboard: rows } };
}

/** Tanlangan konsol uchun ijara muddatlari — narxlar bazadan keladi */
function rentalOptionsKeyboard(options) {
  return {
    reply_markup: {
      inline_keyboard: options.map((o) => [
        {
          text: `${durationIcon(o.duration)} ${pricingService.formatDurationLabel(o.duration)} — ${pricingService.formatMoney(o.price, o.currency)}`,
          callback_data: `rental:${o.id}`,
        },
      ]),
    },
  };
}

function quickDateKeyboard(options) {
  const buttons = options.map((o, i) => [{ text: o.label, callback_data: `date:${i}` }]);
  buttons.push([{ text: "📅 Boshqa sana kiritish", callback_data: "date:manual" }]);
  return { reply_markup: { inline_keyboard: buttons } };
}

function timeKeyboard() {
  const times = ["09:00", "12:00", "15:00", "18:00", "21:00"];
  return {
    reply_markup: {
      inline_keyboard: [times.map((t) => ({ text: t, callback_data: `time:${t}` }))],
    },
  };
}

function promocodeKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🏷️ Promo-kodim bor", callback_data: "promo:enter" }],
        [{ text: "➡️ O'tkazib yuborish", callback_data: "promo:skip" }],
      ],
    },
  };
}

function confirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Tasdiqlash", callback_data: "order:confirm" },
          { text: "❌ Bekor qilish", callback_data: "order:cancel" },
        ],
      ],
    },
  };
}

function ratingKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [1, 2, 3, 4, 5].map((n) => ({
          text: "⭐".repeat(n),
          callback_data: `rate:${orderId}:${n}`,
        })),
      ],
    },
  };
}

module.exports = {
  mainMenuKeyboard,
  contactRequestKeyboard,
  locationRequestKeyboard,
  consoleTypeKeyboard,
  rentalOptionsKeyboard,
  quickDateKeyboard,
  timeKeyboard,
  promocodeKeyboard,
  confirmKeyboard,
  ratingKeyboard,
};
