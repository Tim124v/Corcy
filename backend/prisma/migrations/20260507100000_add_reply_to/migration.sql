-- Reply/quote для личных сообщений
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Message_replyToId_idx" ON "Message"("replyToId");

-- Reply/quote для сообщений в комнатах
ALTER TABLE "RoomMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;

ALTER TABLE "RoomMessage"
  ADD CONSTRAINT "RoomMessage_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "RoomMessage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "RoomMessage_replyToId_idx" ON "RoomMessage"("replyToId");
