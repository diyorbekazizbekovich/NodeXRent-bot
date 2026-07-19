/**
 * Reusable validation for professional inventory (Joystick / HDMI / Power) wizard.
 * Pure functions — no session side effects.
 */

const INV_NUM_RE = /^[A-Z0-9][A-Z0-9\-_/]{1,31}$/i;
const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function normalizeInventoryNumber(raw) {
  return String(raw || "").trim().toUpperCase();
}

function normalizeSerial(raw) {
  return String(raw || "").trim();
}

function validateInventoryNumber(raw) {
  const value = normalizeInventoryNumber(raw);
  if (!value) return { ok: false, error: "Inventory Number bo'sh bo'lmasin." };
  if (!INV_NUM_RE.test(value)) {
    return {
      ok: false,
      error: "Format noto'g'ri. Masalan: NX-JS-001 (harf, raqam, - _ /).",
    };
  }
  return { ok: true, value };
}

function validateSerial(raw) {
  const value = normalizeSerial(raw);
  if (!value) return { ok: false, error: "Serial Number majburiy." };
  if (value.length < 2 || value.length > 64) {
    return { ok: false, error: "Serial 2–64 belgi bo'lishi kerak." };
  }
  return { ok: true, value };
}

function parseOptionalDate(raw) {
  const text = String(raw || "").trim();
  if (!text || /^\/skip\b/i.test(text)) return { ok: true, value: null, skipped: true };
  const m = text.match(DATE_RE);
  if (!m) {
    return { ok: false, error: "Format: KK.OO.YYYY yoki /skip" };
  }
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
    return { ok: false, error: "Sana noto'g'ri. Format: KK.OO.YYYY yoki /skip" };
  }
  return { ok: true, value: new Date(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`), skipped: false };
}

function parseOptionalNote(raw) {
  const text = String(raw || "").trim();
  if (!text || /^\/skip\b/i.test(text)) return { ok: true, value: null, skipped: true };
  if (text.length > 500) return { ok: false, error: "Izoh 500 belgidan oshmasin." };
  return { ok: true, value: text, skipped: false };
}

module.exports = {
  normalizeInventoryNumber,
  normalizeSerial,
  validateInventoryNumber,
  validateSerial,
  parseOptionalDate,
  parseOptionalNote,
};
