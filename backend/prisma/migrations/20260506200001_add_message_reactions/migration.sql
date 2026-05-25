CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_reactions_messageId_userId_emoji_key"
  ON "message_reactions"("messageId", "userId", "emoji");

CREATE INDEX "message_reactions_messageId_idx"
  ON "message_reactions"("messageId");

ALTER TABLE "message_reactions"
  ADD CONSTRAINT "message_reactions_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_reactions"
  ADD CONSTRAINT "message_reactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
