'use client';

import type { FormEvent } from 'react';
import { Button } from '../ui/Button';

export type EditProfilePanelProps = {
  open: boolean;
  language: 'ru' | 'en';
  saving: boolean;
  name: string;
  setName: (v: string) => void;
  userEmail: string;
  createdAt?: string | null;
  displayAvatar: string | null;
  avatarText: string;
  canRemoveAvatar: boolean;
  onClose: () => void;
  onLogout: () => void;
  onSubmit: (e: FormEvent) => void;
  onUploadPhoto: (file: File | null) => void;
  onRemovePhoto: () => void;
};

export function EditProfilePanel({
  open,
  language,
  saving,
  name,
  setName,
  userEmail,
  createdAt,
  displayAvatar,
  avatarText,
  canRemoveAvatar,
  onClose,
  onLogout,
  onSubmit,
  onUploadPhoto,
  onRemovePhoto,
}: EditProfilePanelProps) {
  if (!open) return null;

  const isEn = language === 'en';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
        aria-label={isEn ? 'Close dialog' : 'Закрыть окно'}
        onClick={onClose}
      />

      <section className="app-modal-card relative z-10 w-full max-w-2xl rounded-[28px] p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              {isEn ? 'Profile' : 'Профиль'}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
              {isEn ? 'Edit profile' : 'Редактирование профиля'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLogout}
              className="text-sm font-medium text-rose-600/90 transition hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200"
            >
              {isEn ? 'Log out' : 'Выйти'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.1]"
            >
              {isEn ? 'Close' : 'Закрыть'}
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              {isEn ? 'Profile photo' : 'Фото профиля'}
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white/85 dark:border-white/10 dark:bg-white/[0.04]">
                {displayAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayAvatar}
                    alt="Profile"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">{avatarText}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]">
                  {isEn ? 'Upload photo' : 'Загрузить фото'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onUploadPhoto(e.target.files?.[0] || null)}
                  />
                </label>

                {canRemoveAvatar && (
                  <button
                    type="button"
                    onClick={onRemovePhoto}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.08]"
                  >
                    {isEn ? 'Remove photo' : 'Удалить фото'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              {isEn ? 'Profile name' : 'Имя профиля'}
            </label>
            <input
              className="app-input rounded-xl px-4 py-3 text-sm outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isEn ? 'Name' : 'Имя'}
            />
          </div>

          <div className="app-shell-muted rounded-xl px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
              {isEn ? 'Account' : 'Аккаунт'}
            </div>
            <div className="mt-2 text-sm text-slate-800 dark:text-slate-200">{userEmail}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {createdAt
                ? isEn
                  ? `Joined ${new Date(createdAt).toLocaleDateString('en-US')}`
                  : `С нами с ${new Date(createdAt).toLocaleDateString('ru-RU')}`
                : isEn
                  ? 'Account information'
                  : 'Информация аккаунта'}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              {isEn ? 'Cancel' : 'Отменить'}
            </Button>
            <Button type="submit" loading={saving}>
              {isEn ? 'Save changes' : 'Сохранить изменения'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

