require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CONSOLE_PRICING = [
  {
    code: "PS3",
    displayName: "PlayStation 3",
    sortOrder: 1,
    prices: [
      { hours: 24, price: 40000 },
      { hours: 48, price: 70000 },
      { hours: 72, price: 95000 },
      { hours: 168, price: 209000 },
    ],
  },
  {
    code: "PS4",
    displayName: "PlayStation 4",
    sortOrder: 2,
    prices: [
      { hours: 24, price: 80000 },
      { hours: 48, price: 140000 },
      { hours: 72, price: 190000 },
      { hours: 168, price: 418000 },
    ],
  },
  {
    code: "PS5",
    displayName: "PlayStation 5",
    sortOrder: 3,
    prices: [
      { hours: 24, price: 120000 },
      { hours: 48, price: 220000 },
      { hours: 72, price: 300000 },
      { hours: 168, price: 660000 },
    ],
  },
];

async function main() {
  for (const consoleData of CONSOLE_PRICING) {
    const catalog = await prisma.consoleCatalog.upsert({
      where: { code: consoleData.code },
      update: { displayName: consoleData.displayName, sortOrder: consoleData.sortOrder, isActive: true },
      create: {
        code: consoleData.code,
        displayName: consoleData.displayName,
        sortOrder: consoleData.sortOrder,
      },
    });

    for (const p of consoleData.prices) {
      await prisma.rentalPrice.upsert({
        where: {
          consoleCatalogId_hours: { consoleCatalogId: catalog.id, hours: p.hours },
        },
        update: { price: p.price, currency: "UZS", isActive: true },
        create: {
          consoleCatalogId: catalog.id,
          hours: p.hours,
          price: p.price,
          currency: "UZS",
        },
      });
      console.log(`${consoleData.code} ${p.hours}soat — ${p.price} UZS`);
    }
  }

  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id) => id !== "222222222");

  for (const id of adminIds) {
    await prisma.admin.upsert({
      where: { telegramId: BigInt(id) },
      update: {},
      create: { telegramId: BigInt(id), fullName: "Super Admin", role: "superadmin" },
    });
    console.log(`Admin: ${id}`);
  }

  console.log("Seed muvaffaqiyatli yakunlandi.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
