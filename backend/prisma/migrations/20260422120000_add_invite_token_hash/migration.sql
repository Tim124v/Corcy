CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Invite" ADD COLUMN "tokenHash" TEXT;
ALTER TABLE "Invite" ADD COLUMN "usedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invite" ADD COLUMN "maxUses" INTEGER;
ALTER TABLE "Invite" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

UPDATE "Invite" SET "tokenHash" = encode(digest(convert_to("token", 'UTF8'), 'sha256'), 'hex') WHERE "tokenHash" IS NULL;

UPDATE "Invite" SET "usedCount" = CASE WHEN "usedAt" IS NOT NULL THEN 1 ELSE 0 END;

UPDATE "Invite" SET "isActive" = ("usedAt" IS NULL AND "expiresAt" > NOW());
