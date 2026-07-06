# PlayStation Ijara Telegram Bot

`node-telegram-bot-api` + Express + Prisma + PostgreSQL asosida qurilgan to'liq ishlaydigan backend.

## O'rnatish

```bash
npm install
cp .env.example .env
# .env faylini to'ldiring: BOT_TOKEN, DATABASE_URL, ADMIN_TELEGRAM_IDS ...
```

## Ma'lumotlar bazasi

PostgreSQL'ni Docker orqali ishga tushirish:

```bash
docker compose up -d postgres
```

Prisma migratsiyasi va boshlang'ich ma'lumotlar (tariflar, adminlar):

```bash
npx prisma migrate dev --name init
npm run seed
```

## Ishga tushirish

```bash
npm run dev     # nodemon bilan (development)
npm start        # oddiy ishga tushirish (production)
```

Bot **polling** rejimida `BOT_MODE=polling` bilan ishga tushadi (standart). Production'da `BOT_MODE=webhook` qilib, `WEBHOOK_URL` ni HTTPS domeningizga sozlang.

## Asosiy komandalar

| Komanda | Kim uchun | Vazifasi |
|---|---|---|
| `/start` | Foydalanuvchi | Ro'yxatdan o'tish va asosiy menyu |
| `/courier` | Kuryer | Kuryer sifatida ro'yxatdan o'tish |
| `/profile` | Kuryer | Telefon va hududni to'ldirish |
| `/addps` | Kuryer | Yangi PlayStation qo'shish |
| `/admin` | Admin | Admin panelni ochish |

## Loyiha strukturasi

```
prisma/            — DB sxema va seed
src/config/        — env va Prisma client
src/bot/           — bot handler, keyboard, scene, sessiya
src/services/      — biznes logika (order, assignment, pricing, notification...)
src/jobs/          — cron vazifalar (eslatma, avto-expire, kunlik hisobot)
src/api/           — Express REST endpointlar (statistik JSON, webhook)
```

## Muhim eslatma

- Sessiya (`sessionStore.js`) hozircha **in-memory** — production'da bir nechta instance/PM2 cluster ishlatilsa, buni Redis bilan almashtirish kerak.
- To'lov integratsiyasi (Click/Payme) hozircha ulanmagan — `Payment` modeli tayyor, faqat `method`/`status` ni haqiqiy provayder webhook orqali yangilash kerak bo'ladi.
