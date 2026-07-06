function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function formatDatetime(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatDate(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Bugun va ertaga uchun tez tanlash sanalarini generatsiya qiladi */
function quickDateOptions() {
  const today = new Date();
  const tomorrow = addHours(today, 24);
  return [
    { label: `Bugun (${formatDate(today)})`, value: today.toISOString() },
    { label: `Ertaga (${formatDate(tomorrow)})`, value: tomorrow.toISOString() },
  ];
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysAgo(n, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

module.exports = {
  addHours,
  formatDatetime,
  formatDate,
  quickDateOptions,
  startOfDay,
  endOfDay,
  daysAgo,
  startOfMonth,
};
