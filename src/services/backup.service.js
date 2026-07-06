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

async function createBackup(adminContext = {}) {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;
  const filePath = path.join(BACKUP_DIR, filename);

  const dbUrl = new URL(env.DATABASE_URL.replace("postgresql://", "http://"));
  const dbName = dbUrl.pathname.replace("/", "").split("?")[0];
  const user = dbUrl.username;
  const host = dbUrl.searchParams.get("host") || "/var/run/postgresql";

  await execFileAsync("pg_dump", ["-U", user, "-h", host, "-d", dbName, "-n", "playstation_rental", "-f", filePath], {
    env: { ...process.env, PGPASSWORD: dbUrl.password || "" },
  });

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

module.exports = { createBackup, listBackups, getBackupFile, BACKUP_DIR };
