import { z } from 'zod';

const AttachmentSchema = z.object({
  url: z.string().url('Некорректный URL вложения').max(2048).optional(),
  name: z.string().max(255).optional(),
  type: z.string().max(127).optional(),
});

export const SendMessageSchema = z.object({
  to: z.string().min(1, 'Получатель обязателен').max(128),
  text: z.string().max(4000, 'Сообщение не должно превышать 4000 символов').optional().default(''),
  attachment: AttachmentSchema.optional(),
  replyToId: z.string().max(128).optional(),
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;

export const SearchMessagesSchema = z.object({
  q: z.string().min(2, 'Минимум 2 символа').max(200),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type SearchMessagesDto = z.infer<typeof SearchMessagesSchema>;

export const EditMessageSchema = z.object({
  text: z.string().min(1, 'Текст обязателен').max(4000),
});
export type EditMessageDto = z.infer<typeof EditMessageSchema>;
