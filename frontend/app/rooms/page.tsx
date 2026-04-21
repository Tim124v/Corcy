'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { useLanguage } from '../../components/language-provider';
import { useNotificationsStore } from '../../store/notifications';
import { RoomsPanel } from '../../components/profile/RoomsPanel';
import { SecureInput } from '../../components/ui/SecureInput';
import { Button } from '../../components/ui/Button';

type Room = {
  id: string;
  name: string;
  owner: { id: string; email: string; name: string | null };
  joinedAt: string;
  isOwner: boolean;
};

export default function RoomsPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const { language } = useLanguage();
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const isEn = language === 'en';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomPass, setRoomPass] = useState('');
  const [roomMsg, setRoomMsg] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [message, setMessage] = useState('');
  const [joining, setJoining] = useState(false);
  const [pastingCode, setPastingCode] = useState(false);

  const loadRooms = async () => {
    try {
      const list = await api<Room[]>('/rooms', { method: 'GET' });
      setRooms(list);
    } catch {
      setRooms([]);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      router.replace('/');
      return;
    }

    void loadRooms();
  }, [accessToken, router]);

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !roomPassword.trim()) return;

    setJoining(true);
    setMessage('');

    try {
      const room = await api<Room>('/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ roomId: roomCode.trim(), password: roomPassword }),
      });

      setRoomCode('');
      setRoomPassword('');
      setMessage(isEn ? 'Room joined successfully.' : 'Вы успешно вошли в комнату.');
      addNotification({
        type: 'room',
        title: isEn ? 'Joined room' : 'Вход в комнату',
        message: isEn ? `You joined the room "${room.name}".` : `Вы вошли в комнату "${room.name}".`,
      });
      await loadRooms();
      router.push(`/dashboard?room=${room.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : isEn ? 'Failed to join room' : 'Не удалось войти в комнату');
    } finally {
      setJoining(false);
    }
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomMsg('');
    try {
      await api('/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: roomName.trim() || 'Комната', password: roomPass }),
      });
      setRoomName('');
      setRoomPass('');
      setRoomMsg(isEn ? 'Room created.' : 'Комната создана.');
      addNotification({
        type: 'room',
        title: isEn ? 'Room created' : 'Комната создана',
        message: isEn ? 'Your new room is now available in the list.' : 'Новая комната уже доступна в списке.',
      });
      await loadRooms();
    } catch (err) {
      setRoomMsg(err instanceof Error ? err.message : isEn ? 'Failed to create room' : 'Не удалось создать комнату');
    }
  };

  const deleteRoom = async (roomId: string) => {
    setRoomMsg('');
    try {
      await api(`/rooms/${roomId}`, { method: 'DELETE' });
      setRoomMsg(isEn ? 'Room deleted.' : 'Комната удалена.');
      addNotification({
        type: 'room',
        title: isEn ? 'Room deleted' : 'Комната удалена',
        message: isEn ? 'The room was removed successfully.' : 'Комната была успешно удалена.',
      });
      await loadRooms();
    } catch (err) {
      setRoomMsg(err instanceof Error ? err.message : isEn ? 'Failed to delete room' : 'Не удалось удалить комнату');
    }
  };

  const leaveRoom = async (roomId: string) => {
    setRoomMsg('');
    try {
      await api(`/rooms/${roomId}/leave`, { method: 'POST' });
      setRoomMsg(isEn ? 'You left the room.' : 'Вы покинули комнату.');
      addNotification({
        type: 'room',
        title: isEn ? 'Left room' : 'Покинули комнату',
        message: isEn ? 'You have left the room.' : 'Вы вышли из комнаты.',
      });
      await loadRooms();
    } catch (err) {
      setRoomMsg(err instanceof Error ? err.message : isEn ? 'Failed to leave room' : 'Не удалось покинуть комнату');
    }
  };

  const pasteRoomCode = async () => {
    setMessage('');
    setPastingCode(true);
    try {
      const value = await navigator.clipboard?.readText();
      if (value) {
        setRoomCode(value.trim());
      }
    } catch {
      setMessage(isEn ? 'Could not access clipboard.' : 'Не удалось получить доступ к буферу обмена.');
    } finally {
      setPastingCode(false);
    }
  };

  return (
    <main className="app-page-bg min-h-screen text-slate-900 dark:text-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-8 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute right-8 top-10 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <header className="mb-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/dashboard" className="transition hover:text-blue-600 dark:hover:text-blue-300">← {isEn ? 'Chats' : 'Чаты'}</Link>
          <span>/</span>
          <span>{isEn ? 'Rooms' : 'Комнаты'}</span>
        </header>

        <div className="space-y-6">
          <section className="app-shell-card rounded-[24px] p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                {isEn ? 'Join room' : 'Вход в комнату'}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {isEn ? 'Enter by code' : 'Войти по коду'}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {isEn
                  ? 'Use the room code and password you received from the room owner.'
                  : 'Используйте код комнаты и пароль, который вам передал владелец комнаты.'}
              </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="app-chip rounded-full px-3 py-1.5 text-xs font-medium">
                  {isEn ? `Rooms: ${rooms.length}` : `Комнат: ${rooms.length}`}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => document.getElementById('my-rooms-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                >
                  {isEn ? 'My rooms below' : 'Мои комнаты ниже'}
                </Button>
              </div>
            </div>

            <form autoComplete="off" onSubmit={joinRoom} className="app-soft-panel space-y-4 rounded-[22px] p-4">
              <input type="text" name="fake-email" autoComplete="username" className="hidden" tabIndex={-1} />
              <input type="password" name="fake-password" autoComplete="new-password" className="hidden" tabIndex={-1} />
              <div className="grid gap-3 lg:grid-cols-[1fr,auto]">
                <input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder={isEn ? 'Room code' : 'Код комнаты'}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="app-input rounded-2xl px-4 py-3.5 text-sm outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void pasteRoomCode()}
                  disabled={pastingCode}
                  loading={pastingCode}
                  className="shrink-0 rounded-2xl px-4 py-3 text-sm font-medium"
                >
                  {pastingCode ? (isEn ? 'Pasting...' : 'Вставляем...') : (isEn ? 'Paste' : 'Вставить')}
                </Button>
              </div>
              <SecureInput
                value={roomPassword}
                onChange={setRoomPassword}
                placeholder={isEn ? 'Room password' : 'Пароль комнаты'}
                autoComplete="new-password"
                className="app-input rounded-2xl pr-[4.5rem] px-4 py-3.5 text-sm outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setRoomCode('');
                    setRoomPassword('');
                    setMessage('');
                  }}
                  className="rounded-2xl px-4 py-3 text-sm font-medium"
                >
                  {isEn ? 'Clear' : 'Очистить'}
                </Button>
                <Button
                  type="submit"
                  disabled={joining}
                  loading={joining}
                  className="rounded-2xl px-5 py-3 text-sm font-semibold shadow-[0_18px_40px_-18px_rgba(59,130,246,0.95)]"
                >
                  {joining ? (isEn ? 'Connecting...' : 'Подключаем...') : (isEn ? 'Join room' : 'Войти в комнату')}
                </Button>
              </div>
              {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
            </form>
          </section>

          <div id="my-rooms-section">
            <RoomsPanel
              rooms={rooms}
              roomName={roomName}
              setRoomName={setRoomName}
              roomPass={roomPass}
              setRoomPass={setRoomPass}
              onSubmitCreate={createRoom}
              roomMsg={roomMsg}
              onDeleteRoom={deleteRoom}
              onLeaveRoom={leaveRoom}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
