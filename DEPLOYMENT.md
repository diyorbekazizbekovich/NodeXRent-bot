# NodeXRent — Production Deployment Guide (Ubuntu 24.04 Contabo VPS)

This project is **Node.js (JavaScript) + Prisma + PostgreSQL + Docker**.  
There is **no TypeScript build step** — `npm run build` runs `prisma generate`.

GitHub repo: `https://github.com/diyorbekazizbekovich/NodeXRent-bot.git`

---

## 0) Server prerequisites (once)

```bash
# SSH into Contabo VPS
ssh root@YOUR_VPS_IP

# Update OS
apt update && apt upgrade -y

# Install Docker Engine + Compose plugin (if missing)
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git

# Enable Docker on boot (required for 24/7 + reboot recovery)
systemctl enable --now docker

docker --version
docker compose version
```

Optional firewall (UFW) — allow SSH + app port only:

```bash
ufw allow OpenSSH
ufw allow 3000/tcp
ufw enable
ufw status
```

---

## 1) Clone & configure

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/diyorbekazizbekovich/NodeXRent-bot.git nodexrent
cd /opt/nodexrent

cp .env.example .env
nano .env
```

### Required `.env` values

| Variable | Example / notes |
|----------|-----------------|
| `BOT_TOKEN` | From @BotFather |
| `BOT_MODE` | `polling` (recommended on VPS without HTTPS domain) |
| `POSTGRES_USER` | e.g. `nodexrent` |
| `POSTGRES_PASSWORD` | **strong** random password |
| `POSTGRES_DB` | e.g. `nodexrent` |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@postgres:5432/DB?schema=playstation_rental` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `ADMIN_TELEGRAM_IDS` | Your Telegram numeric ID |
| `SUPER_ADMIN_TELEGRAM_IDS` | Same or subset for Factory Reset |
| `RUN_SEED` | `true` **only on first deploy**, then set `false` |

**Important:** hostname in `DATABASE_URL` must be `postgres` (Compose service name), not `localhost`.

Generate a strong password:

```bash
openssl rand -base64 32
```

---

## 2) First deploy (build + start)

```bash
cd /opt/nodexrent

# First boot: seed console catalog + prices
# In .env set: RUN_SEED=true

docker compose build --no-cache
docker compose up -d

# Watch startup (migrate + bot logs)
docker compose logs -f

# In another SSH session — verify containers
docker compose ps
docker ps
```

Healthy output should show:

- `postgres` — healthy  
- `bot` — healthy / running  
- Logs: `PostgreSQL bilan ulanish muvaffaqiyatli`, `Bot ishga tushdi`

After first successful seed:

```bash
# Edit .env → RUN_SEED=false
nano .env
docker compose up -d
```

Health HTTP check from VPS:

```bash
curl -s http://127.0.0.1:3000/health
# {"status":"ok","db":"up",...}
```

---

## 3) Everyday operations

```bash
cd /opt/nodexrent

# Follow live logs
docker compose logs -f bot

# Last 200 lines
docker compose logs --tail=200 bot

# Restart bot only
docker compose restart bot

# Restart everything
docker compose restart

# Stop (containers removed; volumes kept)
docker compose down

# Start again
docker compose up -d
```

Containers use `restart: unless-stopped` → they come back after VPS reboot automatically (Docker enabled).

---

## 4) Update after `git push` (redeploy)

On your laptop / CI:

```bash
git push origin main
```

On the VPS:

```bash
cd /opt/nodexrent
git fetch origin
git pull origin main

# Rebuild image with new code + run migrations on start
docker compose build bot
docker compose up -d bot

docker compose logs -f bot
```

One-liner:

```bash
cd /opt/nodexrent && git pull && docker compose up -d --build bot && docker compose logs -f --tail=100 bot
```

`docker-entrypoint.sh` always runs `prisma migrate deploy` before `node src/server.js`.

---

## 5) Rollback

### A) Code rollback (previous git commit)

```bash
cd /opt/nodexrent
git log --oneline -n 10
git checkout <PREVIOUS_COMMIT_SHA>
docker compose build bot
docker compose up -d bot
docker compose logs -f bot
```

Return to latest:

```bash
git checkout main
git pull
docker compose up -d --build bot
```

### B) Image rollback (if you tagged images)

```bash
docker images | head
# docker tag nodexrent-bot:previous ... then compose up
```

### C) Database rollback

Restore from a SQL backup (see below). Prisma does **not** auto-down migrate.

---

## 6) PostgreSQL backup

### Manual dump (recommended nightly via cron)

```bash
cd /opt/nodexrent
mkdir -p /opt/nodexrent-backups

# Dump only playstation_rental schema from the running postgres container
docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -n playstation_rental \
  > /opt/nodexrent-backups/nodexrent-$(date +%F-%H%M).sql

ls -lh /opt/nodexrent-backups/
```

Or without expanding host env (paste user/db):

```bash
docker compose exec -T postgres \
  pg_dump -U nodexrent -d nodexrent -n playstation_rental \
  > /opt/nodexrent-backups/nodexrent-$(date +%F-%H%M).sql
```

### Cron example (daily 03:00)

```bash
crontab -e
```

```cron
0 3 * * * cd /opt/nodexrent && docker compose exec -T postgres pg_dump -U nodexrent -d nodexrent -n playstation_rental > /opt/nodexrent-backups/nodexrent-$(date +\%F).sql 2>>/var/log/nodexrent-backup.log
```

In-bot **💾 Backup** also writes into the `app_backups` Docker volume (needs `postgresql-client` — already in the image).

---

## 7) PostgreSQL restore

**Warning:** restore overwrites schema data. Stop the bot first.

```bash
cd /opt/nodexrent
docker compose stop bot

# Optional: drop & recreate schema (destructive)
docker compose exec -T postgres \
  psql -U nodexrent -d nodexrent -c 'DROP SCHEMA IF EXISTS playstation_rental CASCADE; CREATE SCHEMA playstation_rental;'

# Restore
cat /opt/nodexrent-backups/nodexrent-YYYY-MM-DD.sql \
  | docker compose exec -T postgres psql -U nodexrent -d nodexrent

docker compose start bot
docker compose logs -f bot
```

---

## 8) Useful diagnostics

```bash
docker compose ps
docker compose top
docker stats

# Enter bot shell
docker compose exec bot sh

# Enter postgres
docker compose exec postgres psql -U nodexrent -d nodexrent

# List Prisma migrations table
docker compose exec postgres \
  psql -U nodexrent -d nodexrent -c 'SELECT * FROM playstation_rental."_prisma_migrations" ORDER BY finished_at DESC LIMIT 10;'
```

---

## 9) Webhook mode (optional)

If you have HTTPS (nginx + Let's Encrypt):

1. Set in `.env`:
   - `BOT_MODE=webhook`
   - `WEBHOOK_URL=https://your-domain.uz`
   - `WEBHOOK_SECRET=<long random>`
2. Proxy `/webhook/<BOT_TOKEN>` → `http://127.0.0.1:3000`
3. `docker compose up -d bot`

Polling mode does **not** need a public domain.

---

## 10) Security checklist

- [ ] `.env` never committed (gitignored)
- [ ] Strong `POSTGRES_PASSWORD`
- [ ] Postgres port **not** published publicly (Compose default)
- [ ] UFW: only SSH + 3000 (or 443 if webhook)
- [ ] `RUN_SEED=false` after first deploy
- [ ] Rotate `BOT_TOKEN` if leaked
- [ ] Regular SQL backups off-server

---

## Architecture (containers)

```text
┌──────────────────────────── Contabo VPS ────────────────────────────┐
│  docker compose                                                      │
│    ┌─────────────┐     internal net      ┌──────────────────────┐   │
│    │  bot:3000   │ ────────────────────► │ postgres:5432        │   │
│    │ Node+Prisma │                       │ volume: pgdata       │   │
│    │ volumes:    │                       └──────────────────────┘   │
│    │  logs       │                                                   │
│    │  backups    │   host:3000 → bot:3000                            │
│    │  uploads    │                                                   │
│    └─────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

Startup sequence (`docker/docker-entrypoint.sh`):

1. Wait for Postgres  
2. `prisma migrate deploy`  
3. Optional seed if `RUN_SEED=true`  
4. `node src/server.js`
