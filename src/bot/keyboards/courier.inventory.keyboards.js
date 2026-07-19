const inventoryItemService = require("../../services/inventoryItem.service");
const { ITEM_TYPES } = require("../../constants/inventoryItem");
const { CONDITIONS, labelCondition } = require("../../constants/inventoryItem");

function chunkButtons(items, callbackBuilder, perRow = 1) {
  const rows = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(
      items.slice(i, i + perRow).map((item) => ({
        text: inventoryItemService.formatItemButton(item),
        callback_data: callbackBuilder(item),
      }))
    );
  }
  return rows;
}

function consolePickKeyboard(orderId, consoles) {
  const rows = chunkButtons(consoles, (c) => `courier:hw:console:${orderId}:${c.id}`);
  if (!rows.length) {
    rows.push([{ text: "❌ Bo'sh konsol yo'q", callback_data: "courier:hw:noop" }]);
  }
  return { reply_markup: { inline_keyboard: rows } };
}

function joystickPickKeyboard(orderId, joysticks, selectedIds = []) {
  const selected = new Set(selectedIds.map(Number));
  const rows = joysticks.map((j) => {
    const on = selected.has(j.id);
    return [
      {
        text: `${on ? "✅ " : ""}${inventoryItemService.formatItemButton(j)}`,
        callback_data: `courier:hw:js:${orderId}:${j.id}`,
      },
    ];
  });
  rows.push([
    {
      text: `➡️ Davom etish (${selected.size}/4)`,
      callback_data: `courier:hw:jsDone:${orderId}`,
    },
  ]);
  rows.push([
    { text: "❌ Wizardni bekor qilish", callback_data: `courier:hw:cancel:${orderId}` },
  ]);
  return { reply_markup: { inline_keyboard: rows } };
}

function singlePickKeyboard(orderId, items, kind) {
  // kind: hdmi | power
  const rows = chunkButtons(items, (c) => `courier:hw:${kind}:${orderId}:${c.id}`);
  if (!rows.length) {
    rows.push([{ text: "❌ Mavjud emas", callback_data: "courier:hw:noop" }]);
  }
  rows.push([
    { text: "❌ Wizardni bekor qilish", callback_data: `courier:hw:cancel:${orderId}` },
  ]);
  return { reply_markup: { inline_keyboard: rows } };
}

function returnConfirmItemKeyboard(orderId, linkId, label) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: `✅ ${label} qaytarildi`, callback_data: `courier:ret:item:${orderId}:${linkId}` }],
      ],
    },
  };
}

function returnCollateralKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Ha", callback_data: `courier:ret:collateral:${orderId}:yes` },
          { text: "❌ Yo'q", callback_data: `courier:ret:collateral:${orderId}:no` },
        ],
      ],
    },
  };
}

function returnConditionKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: `🟢 ${labelCondition(CONDITIONS.IDEAL)}`, callback_data: `courier:ret:cond:${orderId}:IDEAL` }],
        [{ text: `🟡 ${labelCondition(CONDITIONS.GOOD)}`, callback_data: `courier:ret:cond:${orderId}:GOOD` }],
        [
          {
            text: `🟠 ${labelCondition(CONDITIONS.MINOR_ISSUE)}`,
            callback_data: `courier:ret:cond:${orderId}:MINOR_ISSUE`,
          },
        ],
        [
          {
            text: `🔴 ${labelCondition(CONDITIONS.SERIOUS_ISSUE)}`,
            callback_data: `courier:ret:cond:${orderId}:SERIOUS_ISSUE`,
          },
        ],
      ],
    },
  };
}

module.exports = {
  consolePickKeyboard,
  joystickPickKeyboard,
  singlePickKeyboard,
  returnConfirmItemKeyboard,
  returnCollateralKeyboard,
  returnConditionKeyboard,
  ITEM_TYPES,
};
