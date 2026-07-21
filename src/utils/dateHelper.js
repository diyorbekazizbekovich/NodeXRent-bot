/** Biznes vaqti — O'zbekiston */
const TZ = "Asia/Tashkent";

function zonedParts(date = new Date()) {
  const d = new Date(date);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Berilgan Tashkent kalendar kuni + soat uchun UTC Date */
function zonedDateTime(year, month, day, hour = 0, minute = 0, second = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour - 5, minute, second));
  const parts = zonedParts(utcGuess);
  const desiredAsMinutes = ((hour * 60 + minute) - (parts.hour * 60 + parts.minute));
  return new Date(utcGuess.getTime() + desiredAsMinutes * 60 * 1000);
}

function addHours(date, hours) {
  return new Date(new Date(date).getTime() + hours * 60 * 60 * 1000);
}

/**
 * Human remaining time until `target` (Tashkent-friendly wording).
 * e.g. "1 kun 8 soat", "12 soat 15 daqiqa", "tugagan"
 */
function formatRemainingDuration(target, now = new Date()) {
  const ms = new Date(target).getTime() - new Date(now).getTime();
  if (!Number.isFinite(ms)) return "—";
  if (ms <= 0) return "tugagan";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} kun`);
  if (hours > 0) parts.push(`${hours} soat`);
  if (days === 0 && (minutes > 0 || parts.length === 0)) parts.push(`${minutes} daqiqa`);
  return parts.join(" ");
}

function formatDatetime(date) {
  if (date == null || date === "") return "—";
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return "—";
  const p = zonedParts(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(p.day)}.${pad(p.month)}.${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

function formatDate(date) {
  const p = zonedParts(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(p.day)}.${pad(p.month)}.${p.year}`;
}

function startOfDay(date = new Date()) {
  const p = zonedParts(date);
  return zonedDateTime(p.year, p.month, p.day, 0, 0, 0);
}

function endOfDay(date = new Date()) {
  const p = zonedParts(date);
  return zonedDateTime(p.year, p.month, p.day, 23, 59, 59);
}

/** Bugun / ertaga — Tashkent kalendar kunining 00:00 */
function quickDateOptions(now = new Date(), lang) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(lang);
  const p = zonedParts(now);
  const today = zonedDateTime(p.year, p.month, p.day, 0, 0, 0);
  const tomorrowParts = zonedParts(addHours(today, 26));
  const tomorrow = zonedDateTime(tomorrowParts.year, tomorrowParts.month, tomorrowParts.day, 0, 0, 0);
  return [
    { label: t("order.today", L, { date: formatDate(today) }), value: today.toISOString() },
    { label: t("order.tomorrow", L, { date: formatDate(tomorrow) }), value: tomorrow.toISOString() },
  ];
}

function daysAgo(n, from = new Date()) {
  return addHours(from, -n * 24);
}

function startOfMonth(date = new Date()) {
  const p = zonedParts(date);
  return zonedDateTime(p.year, p.month, 1, 0, 0, 0);
}

module.exports = {
  TZ,
  zonedParts,
  zonedDateTime,
  addHours,
  formatRemainingDuration,
  formatDatetime,
  formatDate,
  quickDateOptions,
  startOfDay,
  endOfDay,
  daysAgo,
  startOfMonth,
};
