import { z } from 'zod';

const AttachmentSchema = z.object({
  url: z.string().url('Некорректный URL вложения').max(2048).optional(),
  name: z.string().max(255).optional(),
  type: z.string().max(127).optional(),
});

export const CreateRoomSchema = z.object({
  name: z.string().max(100).optional().default('Комната'),
  password: z.string().min(1, 'Пароль комнаты обязателен').max(128),
});

export const JoinRoomSchema = z.object({
  roomId: z.string().min(1, 'ID комнаты обязателен').max(128),
  password: z.string().min(1, 'Пароль обязателен').max(128),
});

export const SendRoomMessageSchema = z.object({
  text: z.string().max(4000, 'Сообщение не должно превышать 4000 символов').optional().default(''),
  attachment: AttachmentSchema.optional(),
  replyToId: z.string().max(128).optional(),
});

export type CreateRoomDto = z.infer<typeof CreateRoomSchema>;
export type JoinRoomDto = z.infer<typeof JoinRoomSchema>;
export type SendRoomMessageDto = z.infer<typeof SendRoomMessageSchema>;

export const SearchRoomMessagesSchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type SearchRoomMessagesDto = z.infer<typeof SearchRoomMessagesSchema>;

export const EditRoomMessageSchema = z.object({
  text: z.string().min(1).max(4000),
});
export type EditRoomMessageDto = z.infer<typeof EditRoomMessageSchema>;
