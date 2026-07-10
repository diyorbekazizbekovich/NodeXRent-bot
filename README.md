<p align="center">
  <img src="docs/banner.png" alt="NodeXRent Banner" width="720" />
</p>

<h1 align="center">NodeXRent</h1>

<p align="center">
  <strong>Professional PlayStation Rental Management System</strong><br/>
  powered by Telegram Bot · Express · Prisma · PostgreSQL
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/status-production--ready-brightgreen" alt="Production Ready" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/node.js-20+-339933?logo=nodedotjs&logoColor=white" alt="Node.js" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/postgresql-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/prisma-5.x-2D3748?logo=prisma&logoColor=white" alt="Prisma" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

<p align="center">
  End-to-end rental operations for PlayStation consoles:<br/>
  orders · inventory · couriers · contracts · payments · CRM · analytics — all inside Telegram.
</p>

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [User Roles](#user-roles)
- [Inventory System](#inventory-system)
- [Rental Workflow](#rental-workflow)
- [Security](#security)
- [Production Deployment](#production-deployment)
- [Scripts](#scripts)
- [API & Bot Commands](#api--bot-commands)
- [Architecture Notes](#architecture-notes)
- [Future Roadmap](#future-roadmap)
- [Code Quality](#code-quality)
- [Contributing](#contributing)
- [Support](#support)
- [Author](#author)
- [License](#license)

---

## Features

| Area | Capabilities |
|------|----------------|
| **Telegram Bot** | Polling & webhook modes, reply + inline keyboards, multi-role UX |
| **Multi-language** | Customer UI in **Uzbek (UZ)** and **Russian (RU)** |
| **Order management** | Console selection, duration pricing, date/time, promo codes, confirmation |
| **Rental lifecycle** | PENDING → assignment → delivery → ACTIVE → return → COMPLETED |
| **Inventory** | Professional items: Console, Joystick (×4), HDMI, Power — status tracking |
| **Courier ops** | Accept/reject, on the way, arrived, handover wizard, return wizard |
| **Contracts** | PDF rental contracts generated with **PDFKit** |
| **Photos** | Handover & return customer photos stored with Telegram file IDs |
| **Payments** | Cash / Card / Click tracking at delivery; payment received flags |
| **Collateral** | ID card / passport / none — taken & returned tracking |
| **CRM** | Customer search, profiles, ratings (Trusted / Normal / Risky), admin notes |
| **Support chat** | Admin ↔ customer media chat with DB history & reply buttons |
| **Analytics** | Today / week / month / all — orders, revenue, inventory, couriers |
| **Dynamic pricing** | Console catalog + rental price options (hours-based) |
| **Promo codes** | Percent / fixed / loyalty discounts with limits & expiry |
| **Rental extension** | Customer requests; admin approve / reject |
| **Notifications** | Order events to admins, couriers, and customers |
| **Broadcast / ads** | Admin media broadcast to all users |
| **Admin panel** | Dashboard, CRM, orders, inventory, pricing, couriers, logs, settings |
| **Super Admin** | Factory Reset with multi-step confirmation & token protection |
| **Backup** | Database backup creation & download from admin UI |
| **Rate limiting** | Client anti-spam (admins/couriers bypass) |
| **Audit logs** | Admin action history |
| **Cron jobs** | Return reminders, auto-expire, courier timeout alerts, daily report |
| **REST API** | Health check + admin/pricing JSON endpoints |
| **Docker** | `Dockerfile` + `docker-compose` (Postgres + app) |

---

## Screenshots

> Placeholders — add real captures under `docs/screenshots/`.

| Customer | Courier | Admin |
|----------|---------|-------|
| ![Customer menu](docs/screenshots/customer-menu.png) | ![Courier flow](docs/screenshots/courier-handover.png) | ![Admin analytics](docs/screenshots/admin-analytics.png) |
| *Main menu (UZ/RU)* | *Handover wizard* | *Analytics dashboard* |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | **Node.js** (v20+ recommended) |
| Language | **JavaScript** (CommonJS) |
| Bot | **node-telegram-bot-api** |
| HTTP | **Express** |
| ORM | **Prisma** 5.x |
| Database | **PostgreSQL** 16 |
| PDF | **PDFKit** |
| Jobs | **node-cron** |
| Logging | **Winston** |
| Config | **dotenv** |
| Containers | **Docker** / **Docker Compose** |

> **Not in this repository (optional for production):** PM2, Nginx, Redis session store, ESLint/Prettier. See [Production Deployment](#production-deployment).

---

## Project Structure

```text
playstation-rental-bot/
├── prisma/
│   ├── schema.prisma              # Data models & enums
│   ├── seed.js                    # Initial catalog / pricing / admins
│   └── migrate-*.sql              # Manual SQL migrations (feature modules)
├── src/
│   ├── server.js                  # App bootstrap (singleton-safe)
│   ├── app.js                     # Express app + webhook + health
│   ├── config/                    # env, Prisma client
│   ├── bot/
│   │   ├── index.js               # Bot factory (singleton)
│   │   ├── sessionStore.js        # In-memory scene sessions
│   │   ├── events/                # Central callback router & listener registry
│   │   ├── handlers/              # User / courier / admin handlers
│   │   ├── keyboards/             # Reply & inline keyboards
│   │   ├── scenes/                # Order, handover, return wizards
│   │   ├── middleware/            # Rate limit, unknown message
│   │   └── helpers/               # Callback helpers, dedupe
│   ├── services/                  # Business logic
│   ├── repositories/              # Data access
│   ├── api/routes/                # REST admin / pricing routes
│   ├── jobs/                      # Cron & interval jobs (+ jobGuard)
│   ├── i18n/ + locales/           # UZ / RU strings
│   ├── constants/                 # Statuses, support steps, ratings
│   ├── middleware/                # HTTP RBAC
│   ├── validators/                # Input validation
│   ├── errors/                    # Domain errors
│   ├── stores/                    # Dashboard subscriptions
│   └── utils/                     # Dates, admin recipients, logger
├── uploads/                       # contracts/, photos/, returns/
├── backups/                       # SQL / backup artifacts
├── logs/                          # Winston log output
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── package.json
```

---

## Installation

### Prerequisites

- Node.js **20+**
- PostgreSQL **14+** (or Docker)
- A Telegram Bot token from [@BotFather](https://t.me/BotFather)

### 1. Clone

```bash
git clone https://github.com/your-org/playstation-rental-bot.git
cd playstation-rental-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment

```bash
cp .env.example .env
```

Edit `.env` — at minimum set `BOT_TOKEN`, `DATABASE_URL`, and `ADMIN_TELEGRAM_IDS`.

### 4. Database (Docker Postgres)

```bash
docker compose up -d postgres
```

### 5. Prisma client & schema

```bash
npm run prisma:generate
npx prisma migrate dev --name init
```

If you use the project’s SQL feature migrations (inventory, support chat, etc.), apply them against your schema as documented in `prisma/migrate-*.sql`.

### 6. Seed

```bash
npm run seed
```

### 7. Run

**Development** (nodemon):

```bash
npm run dev
```

**Production**:

```bash
npm start
```

Default bot mode is **polling** (`BOT_MODE=polling`). Health check:

```bash
curl http://localhost:3000/health
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token |
| `BOT_MODE` | No | `polling` (default) or `webhook` |
| `WEBHOOK_URL` | Webhook | Public HTTPS base URL |
| `WEBHOOK_SECRET` | Webhook | Secret token for Telegram webhook header |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Prisma) |
| `PORT` | No | Express port (default `3000`) |
| `NODE_ENV` | No | `development` / `production` |
| `ADMIN_TELEGRAM_IDS` | Yes | Comma-separated admin Telegram IDs |
| `SUPER_ADMIN_TELEGRAM_IDS` | No | Super admins (Factory Reset). If empty → first `ADMIN_TELEGRAM_IDS` entry |
| `RETURN_REMINDER_HOURS_BEFORE` | No | Hours before rental end to remind (default `2`) |
| `COURIER_RESPONSE_TIMEOUT_MINUTES` | No | Alert admins if order stays PENDING (default `10`) |
| `DEFAULT_COMMISSION_PERCENT` | No | Commission percent (default `0`) |
| `RATE_LIMIT_WINDOW_MS` | No | Client rate-limit window (default `2000`) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window (default `3`) |
| `RATE_LIMIT_BLOCK_MS` | No | Block duration (default `60000`) |

See [`.env.example`](.env.example) for a complete template.

---

## Database

### Overview

All persistent state lives in **PostgreSQL**, accessed through **Prisma**.

Core domains:

- **Users / Couriers / Admins**
- **Orders** + status logs, payments, extensions, reviews
- **InventoryItem** (console / joystick / HDMI / power) + history
- **RentalContract** + **OrderPhoto**
- **Promocode**, **ConsoleCatalog**, **RentalPrice**
- **SupportThread** / **SupportMessage** (CRM chat)
- **Notification**, **AdminAuditLog**, **DatabaseBackup**, **AdCampaign**

### Migrations

```bash
# Generate client after schema changes
npm run prisma:generate

# Dev migration
npm run prisma:migrate

# Explore data
npm run prisma:studio
```

Feature SQL scripts (examples):

- `prisma/migrate-inventory-rental-v2.sql`
- `prisma/migrate-support-chat.sql`
- `prisma/migrate-delivery-handover.sql`
- `prisma/migrate-user-language.sql`

### Transactions

Critical flows (handover completion, factory reset, support message writes) use **Prisma `$transaction`** so partial updates roll back on failure.

---

## User Roles

| Role | How identified | Capabilities |
|------|----------------|--------------|
| **Customer** | `users` table | Register, order, extend rental, view history, reply to support, choose language |
| **Courier** | `couriers` table + `/courier` | Accept orders, delivery status, handover/return wizards, profile |
| **Admin** | `ADMIN_TELEGRAM_IDS` or `admins` table | Full admin panel: CRM, orders, inventory, pricing, analytics, ads, backups |
| **Super Admin** | `SUPER_ADMIN_TELEGRAM_IDS` (or first admin ID) | Everything Admin has + **Factory Reset** |

Rate limiting applies to **customers only**; admins and couriers are privileged.

---

## Inventory System

NodeXRent tracks **physical assets**, not just abstract console types.

### Item types

| Type | Notes |
|------|--------|
| `CONSOLE` | PS3 / PS4 / PS5 |
| `JOYSTICK` | Typically 4 per handover |
| `HDMI` | Cable |
| `POWER` | Power adapter |

### Statuses

`AVAILABLE` → `RESERVED` → `RENTED` → back to `AVAILABLE` (or `MAINTENANCE`)

### Handover wizard (courier)

1. Select console  
2. Select 4 joysticks  
3. Select HDMI + power  
4. Collateral  
5. Payment method  
6. Customer + contract photo  
7. PDF contract + order → **ACTIVE**, items → **RENTED**

### Return wizard

Confirm items → collateral returned → condition → note → photo → items **AVAILABLE**, order **COMPLETED**.

---

## Rental Workflow

```text
┌─────────────┐
│  Customer   │  /start → language → phone → location
│  places     │  → console → duration → date/time → promo → confirm
│  order      │
└──────┬──────┘
       │ PENDING
       ▼
┌─────────────┐
│   Admin     │  Confirm / reject / assign courier
└──────┬──────┘
       │ COURIER_ASSIGNED / ACCEPTED
       ▼
┌─────────────┐
│   Courier   │  On the way → Arrived
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Handover   │  Inventory + collateral + payment + photo
│  Wizard     │  → PDF contract
└──────┬──────┘
       │ ACTIVE (RENTED inventory)
       ▼
┌─────────────┐
│   Rental    │  Optional: extend request → admin approve
└──────┬──────┘
       │ RETURN_REQUESTED / return flow
       ▼
┌─────────────┐
│   Return    │  Condition + photo → AVAILABLE inventory
│   Wizard    │
└──────┬──────┘
       │ RETURNED → COMPLETED
       ▼
┌─────────────┐
│  Completed  │  Review / history / analytics
└─────────────┘
```

---

## Security

| Control | Implementation |
|---------|----------------|
| **Role validation** | Admin / courier / customer checks on handlers & HTTP RBAC |
| **Super Admin gate** | Factory Reset & dangerous actions |
| **Callback validation** | Prefix routing, ownership checks (orders, support threads) |
| **Tokenized dangerous flows** | Factory Reset uses random tokens + exact phrase `DELETE ALL DATA` |
| **Duplicate protection** | Locks / flags on handover photo, support send, factory reset |
| **Prisma transactions** | Atomic multi-table updates |
| **Rate limiter** | Per-user window for clients |
| **Webhook secret** | `X-Telegram-Bot-Api-Secret-Token` when in webhook mode |
| **Input validation** | Pricing, promo, datetime validators |
| **Audit logging** | Admin actions recorded |
| **Session hygiene** | Menu buttons clear blocking compose sessions |
| **Listener safety** | Single central `callback_query` router (no EventEmitter leak) |

> **Note:** `sessionStore` is **in-memory**. For multi-instance / PM2 cluster, replace with Redis.

---

## Production Deployment

### Option A — Docker Compose (included)

```bash
cp .env.example .env
# fill BOT_TOKEN, ADMIN_TELEGRAM_IDS, etc.

docker compose up -d --build
```

Compose will:

1. Start PostgreSQL 16  
2. Build the Node app  
3. Run `prisma migrate deploy` + seed  
4. Start `node src/server.js` on port **3000**

### Option B — Bare metal / VPS

```bash
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm run seed   # first deploy only
NODE_ENV=production BOT_MODE=webhook npm start
```

### Recommended (not bundled)

| Component | Purpose |
|-----------|---------|
| **PM2** | Process manager, restart on crash |
| **Nginx** | TLS termination, reverse proxy to `:3000` |
| **SSL** | Let’s Encrypt / certbot |
| **Backups** | Use admin Backup + off-site Postgres dumps |
| **Logs** | `logs/` via Winston; ship to your log stack |

### Health check

```http
GET /health
→ { "status": "ok", "time": "..." }
```

### Webhook mode

```env
BOT_MODE=webhook
WEBHOOK_URL=https://your-domain.example
WEBHOOK_SECRET=long-random-secret
```

Telegram will POST to:

```text
POST /webhook/<BOT_TOKEN>
```

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `node src/server.js` | Production start |
| `dev` | `nodemon src/server.js` | Development with reload |
| `prisma:generate` | `prisma generate` | Generate Prisma Client |
| `prisma:migrate` | `prisma migrate dev --name init` | Dev migration |
| `prisma:studio` | `prisma studio` | Visual DB browser |
| `seed` | `node prisma/seed.js` | Seed catalog / prices / admins |

---

## API & Bot Commands

### Bot commands

| Command | Role | Description |
|---------|------|-------------|
| `/start` | Customer | Registration & main menu |
| `/courier` | Courier | Register as courier |
| `/profile` | Courier | Phone / region setup |
| `/addps` | Courier | Add a PlayStation unit |
| `/admin` | Admin | Open admin panel |

### Customer menu (examples)

- Place order · My orders · Extend rental · Change address · Help · Language

### Admin menu (examples)

- Dashboard · Today · CRM · Orders · Inventory · Analytics  
- Couriers · Pricing · Backup · Logs · Promo · Ads · Settings  
- **Factory Reset** (Super Admin only)

### HTTP endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | Public | Liveness |
| `*` | `/api/admin/*` | Admin RBAC | Dashboard / analytics / inventory / settings / audit |
| `*` | `/api/pricing/*` | As configured | Pricing API |
| `*` | `/api/admin/pricing/*` | Admin | Admin pricing API |
| `POST` | `/webhook/:token` | Secret header | Telegram webhook |

---

## Architecture Notes

- **Clean layering:** handlers → services → repositories → Prisma  
- **Central event routing:** one `callback_query` listener; handlers registered via `addCallbackHandler`  
- **Bot singleton:** `createBot()` returns a single instance  
- **Job guard:** cron/interval jobs start once (`jobGuard`)  
- **i18n:** customer-facing strings in `src/locales/uz.json` & `ru.json`  
- **Notifications:** injected bot instance via `initNotificationService`

---

## Future Roadmap

- [ ] Redis-backed sessions for horizontal scaling  
- [ ] Click / Payme payment provider webhooks  
- [ ] ESLint + Prettier + CI pipeline  
- [ ] Typed API layer (optional TypeScript migration)  
- [ ] Admin Web dashboard (beyond Telegram)  
- [ ] Richer analytics exports (CSV / Excel)  
- [ ] Multi-city / multi-warehouse inventory  

---

## Code Quality

This codebase follows practical production patterns:

- **Separation of concerns** — bot UI, services, repositories  
- **SOLID / DRY** — shared broadcast payload helpers, status constants, i18n  
- **Async error handling** — try/catch at handler boundaries; Winston logging  
- **Transactional integrity** — Prisma transactions for critical writes  
- **No EventEmitter listener leaks** — centralized registration with duplicate warnings  

Tooling **not yet** in-repo: ESLint, Prettier, TypeScript compiler. Contributions adding them are welcome.

---

## Contributing

1. Fork the repository  
2. Create a feature branch: `git checkout -b feature/your-feature`  
3. Keep changes focused; do not break existing rental / handover flows  
4. Test with a private bot token and a staging database  
5. Open a Pull Request with a clear summary and test plan  

Please avoid committing `.env`, real tokens, or customer PII.

---

## Support

- Open a **GitHub Issue** for bugs or feature requests  
- Include: Node version, `BOT_MODE`, relevant logs (redact tokens)  
- For operational support in production, contact your deployment maintainer  

In-bot customer help currently surfaces the configured support phone (see locale `help.text`).

---

## Author

**NodeXRent / PlayStation Rental Bot**  
Built for real-world console rental operations on Telegram.

---

## License

This project is released under the [MIT License](LICENSE).

```text
MIT © NodeXRent Contributors
```

If a `LICENSE` file is not yet present in the repository root, add the standard MIT text before publishing publicly.

---

<p align="center">
  <sub>Built with Node.js · Prisma · PostgreSQL · Telegram Bot API</sub><br/>
  <sub>NodeXRent — rent smarter.</sub>
</p>
