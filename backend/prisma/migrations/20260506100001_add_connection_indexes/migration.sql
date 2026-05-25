-- Индексы для cursor-based пагинации списка контактов
CREATE INDEX IF NOT EXISTS "Connection_userIdA_createdAt_idx"
  ON "Connection"("userIdA", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Connection_userIdB_createdAt_idx"
  ON "Connection"("userIdB", "createdAt" DESC);
