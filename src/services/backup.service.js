const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const prisma = require("../config/prisma");
const env = require("../config/env");
const auditLogService = require("./auditLog.service");

const execFileAsync = promisify(execFile);
const BACKUP_DIR = path.join(process.cwd(), "backups");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function parseDatabaseUrl(databaseUrl) {
  // Prisma URL: postgresql://user:pass@host:port/db?schema=playstation_rental
  const normalized = String(databaseUrl || "").replace(/^postgresql:/i, "http:");
  const dbUrl = new URL(normalized);
  const dbName = dbUrl.pathname.replace(/^\//, "").split("?")[0];
  return {
    user: decodeURIComponent(dbUrl.username || "postgres"),
    password: decodeURIComponent(dbUrl.password || ""),
    host: dbUrl.hostname || "localhost",
    port: dbUrl.port || "5432",
    dbName,
    schema: dbUrl.searchParams.get("schema") || "playstation_rental",
  };
}

async function createBackup(adminContext = {}) {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;
  const filePath = path.join(BACKUP_DIR, filename);

  const { user, password, host, port, dbName, schema } = parseDatabaseUrl(env.DATABASE_URL);

  await execFileAsync(
    "pg_dump",
    ["-U", user, "-h", host, "-p", String(port), "-d", dbName, "-n", schema, "-f", filePath],
    {
      env: { ...process.env, PGPASSWORD: password },
    }
  );

  const stat = fs.statSync(filePath);
  const record = await prisma.databaseBackup.create({
    data: {
      filename,
      filePath,
      fileSize: BigInt(stat.size),
      createdByAdminId: adminContext.adminId ?? null,
    },
  });

  await auditLogService.log({
    module: "BACKUP",
    adminId: adminContext.adminId,
    adminTelegramId: adminContext.telegramId,
    action: "DATABASE_BACKUP_CREATED",
    entityType: "DatabaseBackup",
    entityId: record.id,
    afterData: { filename, size: stat.size },
  });

  return record;
}

async function listBackups(limit = 20) {
  return prisma.databaseBackup.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

async function getBackupFile(id) {
  const backup = await prisma.databaseBackup.findUnique({ where: { id: Number(id) } });
  if (!backup || !fs.existsSync(backup.filePath)) return null;
  return backup;
}

module.exports = { createBackup, listBackups, getBackupFile, BACKUP_DIR, parseDatabaseUrl };
