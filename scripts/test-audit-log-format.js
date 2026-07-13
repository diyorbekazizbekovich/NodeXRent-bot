/**
 * Audit log formatter/renderer smoke tests (no DB required for format).
 * Run: node scripts/test-audit-log-format.js
 */
const { formatAuditEntry } = require("../src/services/audit/auditLog.formatter");
const { renderDetail, renderList } = require("../src/services/audit/auditLog.renderer");

let failed = 0;
function check(name, cond) {
  if (!cond) {
    failed += 1;
    console.log(`FAIL  ${name}`);
  } else console.log(`PASS  ${name}`);
}

const factoryEntry = {
  id: 1,
  action: "FACTORY_RESET_EXECUTED",
  module: "FACTORY_RESET",
  adminTelegramId: BigInt("8866189157"),
  createdAt: new Date("2026-07-12T03:37:00+05:00"),
  beforeData: {},
  afterData: {
    counts: {
      users: 6,
      orders: 12,
      payments: 12,
      contracts: 1,
      notifications: 108,
      invItemsReset: 16,
      playstationsReset: 10,
    },
    preserveTelegramIds: [8866189157],
  },
};

const formatted = formatAuditEntry(factoryEntry);
check("factory title", formatted.title === "Factory Reset");
check("factory has users line", formatted.detailLines.some((l) => l.includes("Foydalanuvchilar: 6")));
check("factory has orders line", formatted.detailLines.some((l) => l.includes("Buyurtmalar: 12")));

const detail = renderDetail(factoryEntry);
check("detail has no raw JSON arrow", !detail.includes("{} → {"));
check("detail has no JSON.stringify dump", !detail.includes('"counts"'));
check("detail has Factory Reset", detail.includes("Factory Reset"));
check("detail has Telegram ID", detail.includes("8866189157"));

const promo = formatAuditEntry({
  id: 2,
  action: "PROMO_CREATED",
  adminTelegramId: 1,
  createdAt: new Date("2026-07-12T10:00:00+05:00"),
  afterData: { code: "SUMMER20" },
});
check("promo summary has code", promo.summary.includes("SUMMER20"));

const generic = formatAuditEntry({
  id: 3,
  action: "SOME_UNKNOWN_ACTION",
  createdAt: new Date("2026-07-12T11:00:00+05:00"),
  beforeData: { enabled: false },
  afterData: { enabled: true },
});
check("generic no JSON dump", !JSON.stringify(generic.detailLines).includes("{"));
check("generic shows change", generic.detailLines.some((l) => l.includes("YOQILGAN") || l.includes("O'CHIRILGAN")));

const list = renderList([factoryEntry, promo]);
check("list has Admin loglar", list.includes("Admin loglar"));
check("list no raw JSON", !list.includes('"counts"') && !list.includes("{} →"));

require("../src/services/auditLog.service");
console.log("PASS  auditLog.service loads");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll audit format tests passed");
