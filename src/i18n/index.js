const path = require("path");
const fs = require("fs");

const SUPPORTED = Object.freeze(["UZ", "RU"]);
const DEFAULT_LANG = "UZ";

const locales = {
  UZ: JSON.parse(fs.readFileSync(path.join(__dirname, "../locales/uz.json"), "utf8")),
  RU: JSON.parse(fs.readFileSync(path.join(__dirname, "../locales/ru.json"), "utf8")),
};

function normalizeLang(lang) {
  if (!lang) return null;
  const upper = String(lang).trim().toUpperCase();
  if (upper === "UZ" || upper === "UZB" || upper === "UZBEK") return "UZ";
  if (upper === "RU" || upper === "RUS" || upper === "RUSSIAN") return "RU";
  return null;
}

/** null/undefined → default UZ (UI uchun). Tanlanmagan holat alohida tekshiriladi. */
function resolveLang(lang) {
  return normalizeLang(lang) || DEFAULT_LANG;
}

function getByPath(obj, keyPath) {
  const parts = keyPath.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function interpolate(template, params = {}) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    params[name] != null ? String(params[name]) : ""
  );
}

/**
 * @param {string} key - masalan "welcome.hello"
 * @param {string|null} [lang]
 * @param {Record<string, string|number>} [params]
 */
function t(key, lang, params = {}) {
  const code = resolveLang(lang);
  let value = getByPath(locales[code], key);
  if (value === undefined && code !== DEFAULT_LANG) {
    value = getByPath(locales[DEFAULT_LANG], key);
  }
  if (value === undefined) {
    return key;
  }
  return interpolate(value, params);
}

function languageKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: t("lang.uz", "UZ"), callback_data: "lang:UZ" },
          { text: t("lang.ru", "RU"), callback_data: "lang:RU" },
        ],
      ],
    },
  };
}

/** Menyudagi tugma matnini action kalitiga map qiladi (UZ/RU). */
function matchMenuAction(text) {
  if (!text) return null;
  const trimmed = text.trim();
  for (const code of SUPPORTED) {
    const map = {
      order: t("menu.order", code),
      myOrders: t("menu.myOrders", code),
      extend: t("menu.extend", code),
      changeAddress: t("menu.changeAddress", code),
      help: t("menu.help", code),
      language: t("menu.language", code),
    };
    for (const [action, label] of Object.entries(map)) {
      if (label === trimmed) return action;
    }
  }
  // Til tugmasi har ikkala tilda bir xil
  if (trimmed === "🌐 Til / Язык") return "language";
  return null;
}

function allKnownUserMenuTexts() {
  const set = new Set();
  for (const code of SUPPORTED) {
    set.add(t("menu.order", code));
    set.add(t("menu.myOrders", code));
    set.add(t("menu.extend", code));
    set.add(t("menu.changeAddress", code));
    set.add(t("menu.help", code));
    set.add(t("menu.language", code));
    set.add(t("menu.sharePhone", code));
    set.add(t("menu.shareLocation", code));
  }
  return set;
}

module.exports = {
  SUPPORTED,
  DEFAULT_LANG,
  normalizeLang,
  resolveLang,
  t,
  languageKeyboard,
  matchMenuAction,
  allKnownUserMenuTexts,
};
