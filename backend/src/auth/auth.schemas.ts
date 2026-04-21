import { z } from 'zod';

export const RegisterSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email обязателен')
      .email('Некорректный формат email')
      .max(255, 'Email слишком длинный')
      .transform((s) => s.toLowerCase().trim()),

    password: z
      .string()
      .min(1, 'Пароль обязателен')
      .min(8, 'Минимум 8 символов')
      .max(128, 'Пароль слишком длинный')
      .regex(/[A-Z]/, 'Нужна хотя бы одна заглавная буква')
      .regex(/[a-z]/, 'Нужна хотя бы одна строчная буква')
      .regex(/[0-9]/, 'Нужна хотя бы одна цифра'),

    confirmPassword: z.string().optional(),
    name: z.string().max(50, 'Имя слишком длинное').trim().optional(),
  })
  .refine((d) => d.confirmPassword === undefined || d.confirmPassword === d.password, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Некорректный формат email')
    .max(255)
    .transform((s) => s.toLowerCase().trim()),

  password: z.string().min(1, 'Введите пароль').max(128),
});

export const TwoFactorChallengeSchema = z.object({
  tempToken: z.string().min(1, 'Временный токен обязателен'),
  totpCode: z
    .string()
    .length(6, 'Код должен быть 6 цифр')
    .regex(/^\d{6}$/, 'Код должен содержать только цифры'),
});

export const TwoFactorActivateSchema = z.object({
  token: z
    .string()
    .length(6, 'Код должен быть 6 цифр')
    .regex(/^\d{6}$/, 'Код должен содержать только цифры'),
});

export const VerifyEmailSchema = z.object({
  email: z.string().min(1).email().transform((s) => s.toLowerCase().trim()),
  code: z
    .string()
    .min(1)
    .transform((s) => s.replace(/\D/g, '').slice(0, 6))
    .refine((c) => c.length === 6, { message: 'Код должен быть из 6 цифр' }),
});

export const ResendVerificationSchema = z.object({
  email: z.string().min(1).email().transform((s) => s.toLowerCase().trim()),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Текущий пароль обязателен'),
    newPassword: z
      .string()
      .min(8, 'Минимум 8 символов')
      .max(128)
      .regex(/[A-Z]/, 'Нужна заглавная буква')
      .regex(/[a-z]/, 'Нужна строчная буква')
      .regex(/[0-9]/, 'Нужна цифра'),
    confirmPassword: z.string().min(1, 'Подтверждение пароля обязательно'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'Новый пароль должен отличаться от текущего',
    path: ['newPassword'],
  });

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type TwoFactorChallengeDto = z.infer<typeof TwoFactorChallengeSchema>;
export type TwoFactorActivateDto = z.infer<typeof TwoFactorActivateSchema>;
export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;
export type ResendVerificationDto = z.infer<typeof ResendVerificationSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

export const UseInviteSchema = z.object({
  token: z.string().min(10, 'Некорректный токен').max(100),
});

export const CreateInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(100).optional(),
  expiresHours: z.number().int().min(1).max(720).optional(),
});

export const InviteEmailSchema = CreateInviteSchema.extend({
  email: z.string().min(1).email().transform((s) => s.toLowerCase().trim()),
});

export type UseInviteDto = z.infer<typeof UseInviteSchema>;
export type CreateInviteDto = z.infer<typeof CreateInviteSchema>;
export type InviteEmailDto = z.infer<typeof InviteEmailSchema>;
