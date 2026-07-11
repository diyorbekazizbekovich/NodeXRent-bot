const pricingService = require("../../services/pricing.service");
const { t, resolveLang } = require("../../i18n");

function durationIcon(hours) {
  if (hours === 24) return "🕒";
  if (hours === 48) return "🕑";
  return "⏱";
}

function mainMenuKeyboard(lang) {
  const L = resolveLang(lang);
  return {
    reply_markup: {
      keyboard: [
        [t("menu.order", L), t("menu.myOrders", L)],
        [t("menu.extend", L), t("menu.changeAddress", L)],
        [t("menu.help", L), t("menu.language", L)],
      ],
      resize_keyboard: true,
    },
  };
}

function contactRequestKeyboard(lang) {
  const L = resolveLang(lang);
  return {
    reply_markup: {
      keyboard: [[{ text: t("menu.sharePhone", L), request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

function locationRequestKeyboard(lang) {
  const L = resolveLang(lang);
  return {
    reply_markup: {
      keyboard: [[{ text: t("menu.shareLocation", L), request_location: true }]],
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
function rentalOptionsKeyboard(options, lang) {
  const L = resolveLang(lang);
  return {
    reply_markup: {
      inline_keyboard: options.map((o) => [
        {
          text: `${durationIcon(o.duration)} ${pricingService.formatDurationLabel(o.duration, L)} — ${pricingService.formatMoney(o.price, o.currency, L)}`,
          callback_data: `rental:${o.id}`,
        },
      ]),
    },
  };
}

function quickDateKeyboard(options, lang) {
  const L = resolveLang(lang);
  const buttons = options.map((o, i) => [{ text: o.label, callback_data: `date:${i}` }]);
  buttons.push([{ text: t("order.otherDate", L), callback_data: "date:manual" }]);
  return { reply_markup: { inline_keyboard: buttons } };
}

function timeKeyboard(baseDate) {
  const { getAvailableTimeSlots } = require("../../services/bookingSlot.service");
  const times = getAvailableTimeSlots(baseDate);
  if (times.length === 0) {
    return null;
  }

  const rows = [];
  for (let i = 0; i < times.length; i += 3) {
    rows.push(
      times.slice(i, i + 3).map((slot) => ({
        text: slot,
        callback_data: `time:${slot}`,
      }))
    );
  }

  return { reply_markup: { inline_keyboard: rows } };
}

function promocodeKeyboard(lang) {
  const L = resolveLang(lang);
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: t("order.promoHave", L), callback_data: "promo:enter" }],
        [{ text: t("order.promoSkipBtn", L), callback_data: "promo:skip" }],
      ],
    },
  };
}

function confirmKeyboard(disabled = false, lang) {
  const L = resolveLang(lang);
  if (disabled) {
    return {
      reply_markup: {
        inline_keyboard: [[{ text: t("order.confirmedBtn", L), callback_data: "order:noop" }]],
      },
    };
  }
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: t("order.confirmBtn", L), callback_data: "order:confirm" },
          { text: t("order.cancelBtn", L), callback_data: "order:cancel" },
        ],
      ],
    },
  };
}

function loadingConfirmKeyboard(lang) {
  const L = resolveLang(lang);
  return {
    reply_markup: {
      inline_keyboard: [[{ text: t("order.loadingBtn", L), callback_data: "order:noop" }]],
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

function locationUpdatePickKeyboard(orders, lang) {
  const L = resolveLang(lang);
  const { label } = require("../../constants/orderStatus");
  const rows = orders.map((o) => [
    {
      text: t("locationUpdate.pickItem", L, {
        id: o.id,
        console: o.consoleType,
        status: label(o.status),
      }),
      callback_data: `order:loc:${o.id}`,
    },
  ]);
  return { reply_markup: { inline_keyboard: rows } };
}

function orderLocationActionKeyboard(orderId, lang) {
  const L = resolveLang(lang);
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: t("locationUpdate.btn", L), callback_data: `order:loc:${orderId}` }],
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
  loadingConfirmKeyboard,
  ratingKeyboard,
  locationUpdatePickKeyboard,
  orderLocationActionKeyboard,
};
