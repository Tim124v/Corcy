'use client';

import { useState } from 'react';
import { useLanguage } from '../language-provider';
import { SecureInput } from '../ui/SecureInput';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

type Room = {
  id: string;
  name: string;
  owner: { id: string; email: string; name: string | null };
  isOwner: boolean;
};

type RoomsPanelProps = {
  rooms: Room[];
  roomName: string;
  setRoomName: (v: string) => void;
  roomPass: string;
  setRoomPass: (v: string) => void;
  onSubmitCreate: (e: React.FormEvent) => void;
  roomMsg: string;
  onDeleteRoom?: (roomId: string) => void;
  onLeaveRoom?: (roomId: string) => void;
};

const roomIcons = ['🟣', '🟢', '🔵', '🟠'];

export function RoomsPanel({
  rooms,
  roomName,
  setRoomName,
  roomPass,
  setRoomPass,
  onSubmitCreate,
  roomMsg,
  onDeleteRoom,
  onLeaveRoom,
}: RoomsPanelProps) {
  const { language } = useLanguage();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInviteRoom, setSelectedInviteRoom] = useState<Room | null>(null);
  const [copiedInviteRoomId, setCopiedInviteRoomId] = useState<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyRoomInvite = async (room: Room) => {
    const inviteText =
      language === 'en'
        ? `Join my room in Corsy\nRoom: ${room.name}\nCode: ${room.id}\nPassword: ask the room owner`
        : `Присоединяйся к моей комнате в Corsy\nКомната: ${room.name}\nКод: ${room.id}\nПароль: запросите у владельца комнаты`;

    try {
      await navigator.clipboard?.writeText(inviteText);
      setCopiedInviteRoomId(room.id);
      window.setTimeout(() => {
        setCopiedInviteRoomId((current) => (current === room.id ? null : current));
      }, 2000);
    } catch {
      setCopiedInviteRoomId(null);
    }
  };

  const shareRoomInvite = async (room: Room) => {
    if (!canShare) return;

    const text =
      language === 'en'
        ? `Join my room in Corsy\nRoom: ${room.name}\nCode: ${room.id}\nPassword: ask the room owner`
        : `Присоединяйся к моей комнате в Corsy\nКомната: ${room.name}\nКод: ${room.id}\nПароль: запросите у владельца комнаты`;

    try {
      await navigator.share({
        title: language === 'en' ? `Room invite: ${room.name}` : `Приглашение в комнату: ${room.name}`,
        text,
      });
    } catch {
      // Ignore cancelled share dialogs.
    }
  };

  return (
    <section className="app-shell-card rounded-[24px] p-6 dark:border-slate-700/60">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{language === 'en' ? 'My Rooms' : 'Мои комнаты'}</h2>
        <Button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {showCreateForm
            ? language === 'en'
              ? 'Hide form'
              : 'Скрыть форму'
            : language === 'en'
              ? 'Create room'
              : 'Создать комнату'}
        </Button>
      </div>

      {showCreateForm && (
      <form id="create-room-form" autoComplete="off" onSubmit={onSubmitCreate} className="app-soft-panel mb-6 grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
        <input type="text" name="fake-email" autoComplete="username" className="hidden" tabIndex={-1} />
        <input type="password" name="fake-password" autoComplete="new-password" className="hidden" tabIndex={-1} />
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">{language === 'en' ? 'Name' : 'Название'}</label>
          <input
            name="room-name"
            autoComplete="off"
            className="app-input w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder={language === 'en' ? 'For example: Project Alpha' : 'Например: Project Alpha'}
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">{language === 'en' ? 'Room password' : 'Пароль комнаты'}</label>
          <SecureInput
            name="room-password"
            autoComplete="new-password"
            dataFormType="other"
            className="app-input w-full rounded-xl pr-[4.5rem] px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            value={roomPass}
            onChange={setRoomPass}
            placeholder={language === 'en' ? 'Create password' : 'Придумайте пароль'}
            required
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <Button type="submit">
            {language === 'en' ? 'Create' : 'Создать'}
          </Button>
          {roomMsg && <span className="text-sm text-slate-600 dark:text-slate-300">{roomMsg}</span>}
        </div>
      </form>
      )}

      <ul className="space-y-2">
        {rooms.length === 0 && (
          <li className="app-empty-state rounded-xl">
            <EmptyState
              icon="🏠"
              title={language === 'en' ? 'No rooms yet' : 'Пока нет комнат'}
              description={
                language === 'en'
                  ? 'Create a room and invite participants to start chatting.'
                  : 'Создайте комнату и пригласите участников, чтобы начать общение.'
              }
            />
          </li>
        )}
        {rooms.map((r, i) => (
          <li
            key={r.id}
            className="app-soft-panel flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-28px_rgba(59,130,246,0.25)]"
          >
            <span className="text-xl shrink-0" aria-hidden>{roomIcons[i % roomIcons.length]}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-950 dark:text-white">{r.name}</div>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>{language === 'en' ? 'Members: —' : 'Участников: —'}</span>
                <span>{language === 'en' ? 'Activity: —' : 'Активность: —'}</span>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium"
              onClick={() => navigator.clipboard?.writeText(r.id)}
              title={language === 'en' ? 'Copy room code' : 'Скопировать код комнаты'}
              aria-label={language === 'en' ? 'Copy room code' : 'Скопировать код комнаты'}
            >
              {language === 'en' ? 'Code' : 'Код'}
            </Button>
            <button
              type="button"
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                copiedInviteRoomId === r.id
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'border-slate-200 text-slate-700 hover:bg-white dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.08]'
              }`}
              onClick={() => {
                setSelectedInviteRoom(r);
                setCopiedInviteRoomId(null);
              }}
              title={language === 'en' ? 'Open invitation' : 'Открыть приглашение'}
              aria-label={language === 'en' ? 'Open invitation' : 'Открыть приглашение'}
            >
              {language === 'en' ? 'Invite' : 'Пригласить'}
            </button>
            {!r.isOwner && onLeaveRoom && (
              <button
                type="button"
                onClick={() => onLeaveRoom(r.id)}
                className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:border-slate-300 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.08]"
                title={language === 'en' ? 'Leave room' : 'Покинуть комнату'}
                aria-label={language === 'en' ? 'Leave room' : 'Покинуть комнату'}
              >
                {language === 'en' ? 'Leave' : 'Покинуть'}
              </button>
            )}
            {r.isOwner && (
              <button
                type="button"
                onClick={() => onDeleteRoom?.(r.id)}
                className="shrink-0 p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                title={language === 'en' ? 'Delete' : 'Удалить'}
                aria-label={language === 'en' ? 'Delete' : 'Удалить'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            )}
          </li>
        ))}
      </ul>

      {selectedInviteRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
            aria-label={language === 'en' ? 'Close invite modal' : 'Закрыть окно приглашения'}
            onClick={() => {
              setSelectedInviteRoom(null);
              setCopiedInviteRoomId(null);
            }}
          />
          <section className="app-modal-card relative z-10 w-full max-w-md rounded-[28px] p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {language === 'en' ? 'Room invite' : 'Приглашение в комнату'}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{selectedInviteRoom.name}</h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedInviteRoom(null);
                  setCopiedInviteRoomId(null);
                }}
                className="rounded-full px-3 py-1.5 text-sm"
              >
                {language === 'en' ? 'Close' : 'Закрыть'}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="app-soft-panel flex items-center gap-4 rounded-[24px] p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,rgba(104,127,255,0.22),rgba(84,102,236,0.14))] text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  🔒
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-slate-950 dark:text-white">{selectedInviteRoom.name}</div>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300">
                    <span className="h-2 w-2 rounded-full bg-amber-300" />
                    {language === 'en' ? 'Password required' : 'Только по паролю'}
                  </div>
                </div>
              </div>

              <div className="app-soft-panel rounded-[22px] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {language === 'en' ? 'Room code' : 'Код комнаты'}
                </div>
                <div className="mt-2 break-all rounded-2xl bg-slate-900/6 px-4 py-3 text-sm font-medium text-slate-800 dark:bg-slate-950/60 dark:text-slate-100">
                  {selectedInviteRoom.id}
                </div>
              </div>

              <div className="app-soft-panel rounded-[22px] p-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {language === 'en'
                  ? 'Send this room code to another user. They can open "Invite people", paste the code, enter the room password, and join.'
                  : 'Отправьте этот код другому пользователю. Он сможет открыть "Пригласить людей", вставить код, ввести пароль комнаты и присоединиться.'}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void copyRoomInvite(selectedInviteRoom)}
                  className={`px-4 py-2.5 text-sm font-medium ${
                    copiedInviteRoomId === selectedInviteRoom.id ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20' : ''
                  }`}
                >
                  {copiedInviteRoomId === selectedInviteRoom.id
                    ? language === 'en'
                      ? 'Copied'
                      : 'Скопировано'
                    : language === 'en'
                      ? 'Copy invitation'
                      : 'Скопировать приглашение'}
                </Button>
                {canShare && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void shareRoomInvite(selectedInviteRoom)}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium"
                  >
                    {language === 'en' ? 'Share' : 'Поделиться'}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigator.clipboard?.writeText(selectedInviteRoom.id)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium"
                >
                  {language === 'en' ? 'Copy code only' : 'Скопировать только код'}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
