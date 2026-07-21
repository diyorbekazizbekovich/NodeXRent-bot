/**
 * Console unit + accessory kit summary for an order.
 */
const { ITEM_TYPES, labelItemType } = require("../../constants/inventoryItem");
const { escapeHtml } = require("../../utils/telegramFormat");

function buildInventorySummary(order) {
  const unit = order.inventoryUnit;
  const links = order.orderItems || [];

  const byRole = (role) =>
    links
      .filter((l) => l.role === role || l.inventoryItem?.itemType === role)
      .map((l) => l.inventoryItem)
      .filter(Boolean);

  let joysticks = byRole(ITEM_TYPES.JOYSTICK);
  let hdmis = byRole(ITEM_TYPES.HDMI);
  let powers = byRole(ITEM_TYPES.POWER);
  let consoles = byRole(ITEM_TYPES.CONSOLE);

  // Legacy FK fallbacks
  if (!hdmis.length && order.hdmiItem) hdmis = [order.hdmiItem];
  if (!powers.length && order.powerItem) powers = [order.powerItem];
  if (!consoles.length && order.consoleItem) consoles = [order.consoleItem];

  return {
    unitCode: unit?.unitCode || order.consoleType || "—",
    serialNumber: unit?.serialNumber || consoles[0]?.serialNumber || "—",
    consoleType: unit?.consoleType || order.consoleType,
    unitStatus: unit?.status || null,
    joysticks: joysticks.map((j) => ({
      id: j.id,
      code: j.inventoryNumber,
      serial: j.serialNumber,
    })),
    hdmi: hdmis.map((h) => ({ id: h.id, code: h.inventoryNumber })),
    power: powers.map((p) => ({ id: p.id, code: p.inventoryNumber })),
    legacyConsole: consoles.map((c) => ({ id: c.id, code: c.inventoryNumber })),
  };
}

function formatInventorySection(inv) {
  const jsLines =
    inv.joysticks.length > 0
      ? inv.joysticks.map((j) => `• ${escapeHtml(j.code)}`).join("\n")
      : "• —";

  const hdmi =
    inv.hdmi.length > 0
      ? inv.hdmi.map((h) => escapeHtml(h.code)).join(", ")
      : "—";
  const power =
    inv.power.length > 0
      ? inv.power.map((p) => escapeHtml(p.code)).join(", ")
      : "—";

  return (
    `🎮 <b>${escapeHtml(inv.unitCode)}</b>\n` +
    `🔢 Serial: ${escapeHtml(inv.serialNumber || "—")}\n\n` +
    `🕹 Joystick (${inv.joysticks.length}):\n${jsLines}\n\n` +
    `📺 HDMI: ${hdmi}\n` +
    `🔌 Power: ${power}`
  );
}

module.exports = {
  buildInventorySummary,
  formatInventorySection,
  labelItemType,
};
