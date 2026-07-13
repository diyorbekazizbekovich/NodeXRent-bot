# Multi-stage production image for NodeXRent (Node.js + Prisma + Telegram bot)
# Stage 1: install deps + generate Prisma client
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* ./
# Full install (includes prisma CLI for generate)
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Stage 2: lean runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# openssl for Prisma; postgresql-client for in-bot pg_dump backups
RUN apk add --no-cache openssl libc6-compat postgresql-client tini \
  && mkdir -p /app/logs /app/backups /app/uploads/contracts /app/uploads/photos /app/uploads/returns

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Prisma schema + migrations (needed for migrate deploy at start)
COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# App source (JS — no compile step)
COPY src ./src
COPY docker/docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh \
  && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/docker-entrypoint.sh"]
