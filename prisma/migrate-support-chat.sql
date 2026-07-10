SET search_path TO playstation_rental;

DO $$ BEGIN
  CREATE TYPE "SupportSenderType" AS ENUM ('ADMIN', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SupportThreadStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS support_threads (
  id              SERIAL PRIMARY KEY,
  "userId"        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status          "SupportThreadStatus" NOT NULL DEFAULT 'OPEN',
  "lastMessageAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS support_threads_status_idx ON support_threads(status);
CREATE INDEX IF NOT EXISTS support_threads_lastMessageAt_idx ON support_threads("lastMessageAt");

CREATE TABLE IF NOT EXISTS support_messages (
  id                  SERIAL PRIMARY KEY,
  "threadId"          INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  "senderType"        "SupportSenderType" NOT NULL,
  "senderUserId"      INTEGER,
  "senderAdminId"     INTEGER REFERENCES admins(id),
  "messageType"       TEXT NOT NULL,
  text                TEXT,
  caption             TEXT,
  "fileId"            TEXT,
  payload             JSONB,
  "telegramMessageId" BIGINT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS support_messages_threadId_createdAt_idx
  ON support_messages("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS support_messages_senderType_idx
  ON support_messages("senderType");
