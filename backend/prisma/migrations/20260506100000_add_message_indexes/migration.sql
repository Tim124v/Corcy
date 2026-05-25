-- Индекс для запросов getThread() со стороны отправителя
CREATE INDEX IF NOT EXISTS "Message_senderId_recipientId_createdAt_idx"
  ON "Message"("senderId", "recipientId", "createdAt" DESC);

-- Индекс для запросов getThread() со стороны получателя
CREATE INDEX IF NOT EXISTS "Message_recipientId_senderId_createdAt_idx"
  ON "Message"("recipientId", "senderId", "createdAt" DESC);
