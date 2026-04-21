'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { getAccessToken, useAuthStore } from '../../store/auth';
import { useLanguage } from '../../components/language-provider';
import { useTheme } from '../../components/theme-provider';
import { useCurrentUserAvatar } from '../../hooks/use-current-user-avatar';
import { useNotificationsStore } from '../../store/notifications';
import { useChatActivityStore } from '../../store/chat-activity';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { MessageStatus } from '../../components/chat/MessageStatus';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Connection = { id: string; user: { id: string; email: string; name: string | null; avatarUrl?: string | null } };
type Message = {
  id: string;
  text: string;
  senderId: string;
  recipientId: string;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
};
type Grouped = { title: string; items: (Message | RoomMessage)[] };
type AttachmentDraft = { type: 'media' | 'file'; name: string; file: File; preview?: string; size: number };
type InviteItem = {
  id: string;
  token: string;
  toEmail: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedById: string | null;
  status: 'active' | 'expired' | 'used';
  link: string;
};
type Room = {
  id: string;
  name: string;
  owner: { id: string; email: string; name: string | null; avatarUrl?: string | null };
  joinedAt: string;
  isOwner: boolean;
  expiresAt?: string;
};
type RoomMessage = { id: string; text: string; senderId: string; createdAt: string; systemEventType?: string; attachmentUrl?: string | null; attachmentName?: string | null; attachmentType?: string | null; sender: { id: string; email: string; name: string | null; avatarUrl?: string | null } };

const initials = (name?: string | null, email?: string) => {
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('');
  }
  if (email) return email[0]?.toUpperCase() || '?';
  return '?';
};

const avatarColors = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-blue-500',
] as const;

const getAvatarGradient = (userId: string) => {
  let n = 0;
  for (let i = 0; i < userId.length; i++) n += userId.charCodeAt(i);
  return avatarColors[Math.abs(n) % avatarColors.length];
};

const decodeAttachmentName = (value?: string | null) => {
  if (!value) return '';
  if (!/[ÐÑ]/.test(value)) return value;

  try {
    const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0)));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    const originalNoise = (value.match(/[ÐÑ]/g) || []).length;
    const decodedNoise = (decoded.match(/[ÐÑ]/g) || []).length;
    return decodedNoise < originalNoise ? decoded : value;
  } catch {
    return value;
  }
};

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatRelativeTime = (dateString: string | undefined, now: number, isEn: boolean) => {
  if (!dateString) return isEn ? 'recently' : 'недавно';
  const diff = Math.max(0, now - new Date(dateString).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return isEn ? `${Math.max(1, minutes)} min ago` : `${Math.max(1, minutes)} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isEn ? `${hours} hour${hours > 1 ? 's' : ''} ago` : `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return isEn ? (days === 1 ? 'Yesterday' : `${days} days ago`) : days === 1 ? 'Вчера' : `${days} д назад`;
};

const getLatestIncomingTimestamp = <T extends { senderId: string; createdAt: string }>(
  items: T[],
  currentUserId?: string,
) => {
  if (!currentUserId) return null;
  const latestIncoming = [...items].reverse().find((item) => item.senderId !== currentUserId);
  return latestIncoming?.createdAt || null;
};

const isTimestampNewer = (nextTimestamp: string | null, prevTimestamp?: string) => {
  if (!nextTimestamp) return false;
  if (!prevTimestamp) return true;
  return new Date(nextTimestamp).getTime() > new Date(prevTimestamp).getTime();
};

const renderAvatar = ({
  name,
  email,
  photo,
  userId,
  className = '',
}: {
  name?: string | null;
  email?: string;
  photo?: string | null;
  userId?: string;
  className?: string;
  textClassName?: string;
}) => {
  const gradient = userId ? getAvatarGradient(userId) : 'from-slate-500 to-slate-600';
  const fallbackEl = (
    <div className={`absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ${gradient}`}>
      {initials(name, email)}
    </div>
  );
  const sizeClass = className.includes('h-') ? '' : 'h-10 w-10';
  return (
    <div className={`relative shrink-0 rounded-full overflow-hidden ${sizeClass} ${className}`}>
      {fallbackEl}
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="relative z-10 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
};

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken, logout, hydrated } = useAuthStore();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const unreadDirectIds = useChatActivityStore((s) => s.unreadDirectIds);
  const unreadRoomIds = useChatActivityStore((s) => s.unreadRoomIds);
  const addUnreadDirect = useChatActivityStore((s) => s.addUnreadDirect);
  const addUnreadRoom = useChatActivityStore((s) => s.addUnreadRoom);
  const markDirectAsRead = useChatActivityStore((s) => s.markDirectAsRead);
  const markRoomAsRead = useChatActivityStore((s) => s.markRoomAsRead);
  const profilePhoto = useCurrentUserAvatar(user?.id, user?.avatarUrl);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [selected, setSelected] = useState<Connection | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingRoomMessages, setLoadingRoomMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [isInviteAccordionOpen, setIsInviteAccordionOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [creatingLink, setCreatingLink] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const lastKnownIncomingDirectRef = useRef<Record<string, string>>({});
  const lastKnownIncomingRoomRef = useRef<Record<string, string>>({});
  const messagesCacheRef = useRef<{ rooms: Record<string, RoomMessage[]>; direct: Record<string, Message[]> }>({ rooms: {}, direct: {} });

  useEffect(() => {
    if (!showAttach) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = attachMenuRef.current;
      if (el && !el.contains(e.target as Node)) setShowAttach(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showAttach]);

  const selectedName = useMemo(
    () => (selectedRoom ? selectedRoom.name : selected?.user.name || selected?.user.email || ''),
    [selected, selectedRoom],
  );
  const isEn = language === 'en';
  const isDarkTheme = theme === 'dark';
  const selectedDirectPhoto = selected?.user.avatarUrl || (selected?.user.id && selected?.user.id === user?.id ? profilePhoto : null);
  const filteredConnections = useMemo(() => {
    if (!search.trim()) return connections;
    const q = search.toLowerCase();
    return connections.filter(
      (c) => c.user.email.toLowerCase().includes(q) || (c.user.name || '').toLowerCase().includes(q),
    );
  }, [connections, search]);

  const markDirectThreadAsRead = useCallback((peerId: string, latestTimestamp?: string | null) => {
    markDirectAsRead(peerId);
    if (latestTimestamp) lastKnownIncomingDirectRef.current[peerId] = latestTimestamp;
  }, [markDirectAsRead]);

  const markRoomThreadAsRead = useCallback((roomId: string, latestTimestamp?: string | null) => {
    markRoomAsRead(roomId);
    if (latestTimestamp) lastKnownIncomingRoomRef.current[roomId] = latestTimestamp;
  }, [markRoomAsRead]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hydrated) return;
    if (!accessToken) {
      router.replace('/');
      return;
    }
    api<Connection[]>('/connections', { method: 'GET' })
      .then(setConnections)
      .catch(() => setConnections([]))
      .finally(() => setLoading(false));
    api<InviteItem[]>('/connections/invites', { method: 'GET' })
      .then(setInvites)
      .catch(() => setInvites([]));
    api<Room[]>('/rooms')
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [accessToken, router, hydrated]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Если пришли с инвайта с параметром ?select=<id> — выбираем контакт после загрузки списка
  useEffect(() => {
    if (!connections.length) return;
    const selectId = searchParams.get('select');
    if (!selectId) return;
    const found = connections.find((c) => c.user.id === selectId);
    if (found) setSelected(found);
  }, [connections, searchParams]);

  useEffect(() => {
    if (!rooms.length) return;
    const roomId = searchParams.get('room');
    if (!roomId) return;
    const found = rooms.find((room) => room.id === roomId);
    if (found) {
      setSelected(null);
      setSelectedRoom(found);
      markRoomAsRead(found.id);
    }
  }, [markRoomAsRead, rooms, searchParams]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    const cached = messagesCacheRef.current.direct[selected.user.id];
    if (cached?.length) setMessages(cached);
    else setMessages([]);
    setLoadingMessages(true);
    api<Message[]>(`/messages?with=${selected.user.id}`, { method: 'GET' })
      .then((data) => {
        setMessages(data);
        messagesCacheRef.current.direct[selected.user.id] = data;
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const peerId = selected.user.id;
    const id = setInterval(() => {
      api<Message[]>(`/messages?with=${peerId}`, { method: 'GET' })
        .then((data) => {
          setMessages(data);
          messagesCacheRef.current.direct[peerId] = data;
        })
        .catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, [selected]);

  useEffect(() => {
    if (!selectedRoom) {
      setRoomMessages([]);
      return;
    }
    const cached = messagesCacheRef.current.rooms[selectedRoom.id];
    if (cached?.length) setRoomMessages(cached);
    else setRoomMessages([]);
    setLoadingRoomMessages(true);
    api<RoomMessage[]>(`/rooms/${selectedRoom.id}/messages`, { method: 'GET' })
      .then((data) => {
        setRoomMessages(data);
        messagesCacheRef.current.rooms[selectedRoom.id] = data;
      })
      .catch(() => setRoomMessages([]))
      .finally(() => setLoadingRoomMessages(false));
  }, [selectedRoom]);

  useEffect(() => {
    if (!selectedRoom) return;
    const roomId = selectedRoom.id;
    const id = setInterval(() => {
      api<RoomMessage[]>(`/rooms/${roomId}/messages`, { method: 'GET' })
        .then((data) => {
          setRoomMessages(data);
          messagesCacheRef.current.rooms[roomId] = data;
        })
        .catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, [selectedRoom]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const scrollToBottom = () => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    };
    requestAnimationFrame(scrollToBottom);
    setTimeout(scrollToBottom, 80);
  }, [messages, roomMessages]);

  useEffect(() => {
    if (!user?.id || !connections.length) return;

    let cancelled = false;

    const pollDirectUnread = async () => {
      const results = await Promise.all(
        connections.map(async (connection) => {
          try {
            const thread = await api<Message[]>(`/messages?with=${connection.user.id}`, { method: 'GET' });
            return { peerId: connection.user.id, thread };
          } catch {
            return { peerId: connection.user.id, thread: [] as Message[] };
          }
        }),
      );

      if (cancelled) return;

      results.forEach(({ peerId, thread }) => {
        const latestIncoming = getLatestIncomingTimestamp(thread, user.id);
        const previousIncoming = lastKnownIncomingDirectRef.current[peerId];

        if (!previousIncoming) {
          if (latestIncoming) lastKnownIncomingDirectRef.current[peerId] = latestIncoming;
          return;
        }

        if (isTimestampNewer(latestIncoming, previousIncoming)) {
          lastKnownIncomingDirectRef.current[peerId] = latestIncoming!;
          if (selected?.user.id !== peerId) {
            addUnreadDirect(peerId);
          }
        }
      });
    };

    void pollDirectUnread();
    const intervalId = setInterval(() => void pollDirectUnread(), 20000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [addUnreadDirect, connections, selected?.user.id, user?.id]);

  useEffect(() => {
    if (!user?.id || !rooms.length) return;

    let cancelled = false;

    const pollRoomUnread = async () => {
      const results = await Promise.all(
        rooms.map(async (room) => {
          try {
            const thread = await api<RoomMessage[]>(`/rooms/${room.id}/messages`, { method: 'GET' });
            return { roomId: room.id, thread };
          } catch {
            return { roomId: room.id, thread: [] as RoomMessage[] };
          }
        }),
      );

      if (cancelled) return;

      results.forEach(({ roomId, thread }) => {
        const latestIncoming = getLatestIncomingTimestamp(thread, user.id);
        const previousIncoming = lastKnownIncomingRoomRef.current[roomId];

        if (!previousIncoming) {
          if (latestIncoming) lastKnownIncomingRoomRef.current[roomId] = latestIncoming;
          return;
        }

        if (isTimestampNewer(latestIncoming, previousIncoming)) {
          lastKnownIncomingRoomRef.current[roomId] = latestIncoming!;
          if (selectedRoom?.id !== roomId) {
            addUnreadRoom(roomId);
          }
        }
      });
    };

    void pollRoomUnread();
    const intervalId = setInterval(() => void pollRoomUnread(), 20000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [addUnreadRoom, rooms, selectedRoom?.id, user?.id]);

  useEffect(() => {
    if (!selected?.user.id || !user?.id) return;
    const latestIncoming = getLatestIncomingTimestamp(messages, user.id);
    markDirectThreadAsRead(selected.user.id, latestIncoming);
  }, [markDirectThreadAsRead, messages, selected?.user.id, user?.id]);

  useEffect(() => {
    if (!selectedRoom?.id || !user?.id) return;
    const latestIncoming = getLatestIncomingTimestamp(roomMessages, user.id);
    markRoomThreadAsRead(selectedRoom.id, latestIncoming);
  }, [markRoomThreadAsRead, roomMessages, selectedRoom?.id, user?.id]);

  const chatMessages = useMemo(() => (selectedRoom ? roomMessages : messages), [selectedRoom, roomMessages, messages]);
  const isRoomChat = !!selectedRoom;

  const groupedMessages: Grouped[] = useMemo(() => {
    const byDate = new Map<string, (Message | RoomMessage)[]>();
    chatMessages.forEach((m) => {
      const key = new Date(m.createdAt).toDateString();
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(m);
    });
    const formatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    return Array.from(byDate.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([key, items]) => ({ title: formatter.format(new Date(key)), items }));
  }, [chatMessages]);

  const createInviteLink = async () => {
    setError('');
    setInviteLink('');
    setCreatingLink(true);
    try {
      const res = await api<{ ok: boolean; link?: string; token?: string; error?: string }>('/connections/invite-link', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setError(res.error || 'Не удалось создать ссылку');
        return;
      }
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const link = res.link || (res.token ? `${baseUrl}/invite/${res.token}` : '');
      if (link) {
        setInviteLink(link);
        setCopyStatus('idle');
        addNotification({
          type: 'invite',
          title: isEn ? 'Invite link created' : 'Ссылка приглашения создана',
          message: isEn ? 'A new invite link is ready to share.' : 'Новая ссылка приглашения готова для отправки.',
        });
        try {
          await navigator.clipboard?.writeText(link);
          setCopyStatus('success');
        } catch {
          setCopyStatus('failed');
        }
      }
      api<InviteItem[]>('/connections/invites', { method: 'GET' })
        .then(setInvites)
        .catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка запроса';
      if (msg.includes('fetch') || msg.includes('Failed') || msg === 'Ошибка запроса') {
        setError('Сервер не ответил. Подождите 30–60 сек (холодный старт Render) или проверьте интернет.');
      } else {
        setError(msg);
      }
    } finally {
      setCreatingLink(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRoomChat) {
      if (!selectedRoom || (!messageText.trim() && !attachment) || !user) return;
      const textToSend = messageText.trim();
      const currentAttachment = attachment;
      setMessageText('');
      setShowAttach(false);
      clearAttachment();
      const tempId = `temp-room-${Date.now()}`;
      const optimistic: RoomMessage = {
        id: tempId,
        text: textToSend || (currentAttachment?.name ?? ''),
        senderId: user.id,
        createdAt: new Date().toISOString(),
        attachmentUrl: undefined,
        attachmentName: currentAttachment?.name,
        attachmentType: undefined,
        sender: { id: user.id, email: user.email ?? '', name: user.name ?? null, avatarUrl: user.avatarUrl ?? null },
      };
      setRoomMessages((prev) => {
        const next = [...prev, optimistic];
        messagesCacheRef.current.rooms[selectedRoom.id] = next;
        return next;
      });
      try {
        let uploaded: { url: string; originalName: string; mimeType: string } | null = null;
        if (currentAttachment) {
          const fd = new FormData();
          fd.append('file', currentAttachment.file, currentAttachment.name);
          const token = accessToken || getAccessToken() || '';
          const res = await fetch(`${API_URL}/messages/upload`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: fd,
          });
          if (!res.ok) throw new Error('Не удалось загрузить файл');
          uploaded = await res.json();
        }
        const msg = await api<RoomMessage>(`/rooms/${selectedRoom.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            text: textToSend,
            attachment: uploaded ? { url: uploaded.url, name: uploaded.originalName, type: uploaded.mimeType } : undefined,
          }),
        });
        setRoomMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
        const roomCache = messagesCacheRef.current.rooms[selectedRoom.id];
        if (roomCache) messagesCacheRef.current.rooms[selectedRoom.id] = roomCache.map((m) => (m.id === tempId ? msg : m));
      } catch {
        setRoomMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (currentAttachment) setAttachment(currentAttachment);
      }
      return;
    }

    if (!selected || (!messageText.trim() && !attachment) || !user) return;
    const currentAttachment = attachment;
    const textToSend = messageText.trim();
    setMessageText('');
    setShowAttach(false);
    clearAttachment();
    const tempId = `temp-dm-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      text: textToSend,
      senderId: user.id,
      recipientId: selected.user.id,
      createdAt: new Date().toISOString(),
      attachmentUrl: undefined,
      attachmentName: undefined,
      attachmentType: undefined,
    };
    if (currentAttachment) {
      optimisticMsg.text = optimisticMsg.text || currentAttachment.name;
      optimisticMsg.attachmentName = currentAttachment.name;
    }
    setMessages((prev) => {
      const next = [...prev, optimisticMsg];
      messagesCacheRef.current.direct[selected.user.id] = next;
      return next;
    });
    try {
      let uploaded: { url: string; originalName: string; mimeType: string } | null = null;
      if (currentAttachment) {
        const fd = new FormData();
        fd.append('file', currentAttachment.file, currentAttachment.name);
        const token = accessToken || getAccessToken() || '';
        const res = await fetch(`${API_URL}/messages/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
        });
        if (!res.ok) throw new Error('Не удалось загрузить файл');
        uploaded = await res.json();
      }

      const msg = await api<Message>('/messages', {
        method: 'POST',
        body: JSON.stringify({
          to: selected.user.id,
          text: textToSend,
          attachment: uploaded ? { url: uploaded.url, name: uploaded.originalName, type: uploaded.mimeType } : undefined,
        }),
      });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
      const peerId = selected.user.id;
      const cached = messagesCacheRef.current.direct[peerId];
      if (cached) messagesCacheRef.current.direct[peerId] = cached.map((m) => (m.id === tempId ? msg : m));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (currentAttachment) setAttachment(currentAttachment);
    }
  };

  const deleteDirectMessage = async (messageId: string) => {
    if (!window.confirm(isEn ? 'Delete this message?' : 'Удалить это сообщение?')) return;
    setDeletingMessageId(messageId);
    try {
      await api(`/messages/${messageId}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : isEn ? 'Failed to delete message' : 'Не удалось удалить сообщение');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handlePick = (file: File, kind: AttachmentDraft['type']) => {
    const preview = kind === 'media' ? URL.createObjectURL(file) : undefined;
    setAttachment({ type: kind, name: file.name, file, preview, size: file.size });
    setShowAttach(false);
  };

  const clearAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
  };

  const isMediaType = (mime?: string | null) => {
    if (!mime) return false;
    return mime.startsWith('image/') || mime.startsWith('video/');
  };

  const renderAttachmentContent = (m: Message | RoomMessage) => {
    if (!m.attachmentUrl) return null;
    const attachmentName = decodeAttachmentName(m.attachmentName) || 'file';
    const fileExtension = attachmentName.includes('.') ? attachmentName.split('.').pop()?.toUpperCase() : null;
    const media = isMediaType(m.attachmentType);
    if (media) {
      if (m.attachmentType?.startsWith('video/')) {
        return (
          <div className="overflow-hidden rounded-[20px] bg-slate-950/10 dark:bg-black/20">
            <video controls src={m.attachmentUrl} className="w-full max-h-64 bg-black/20" />
          </div>
        );
      }
      return (
        <div className="overflow-hidden rounded-[20px] bg-slate-950/10 dark:bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.attachmentUrl}
            alt={attachmentName || 'media'}
            className="w-full max-h-72 object-cover"
          />
        </div>
      );
    }
    return (
      <a
        href={m.attachmentUrl}
        download={attachmentName}
        className="flex items-center gap-3 rounded-[18px] bg-slate-900/6 px-3.5 py-3 text-sm no-underline transition hover:bg-slate-900/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-xs font-semibold text-blue-700 dark:text-blue-200">
          {fileExtension || 'FILE'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{attachmentName || 'Файл'}</span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            {m.attachmentType?.startsWith('application/') ? 'Документ' : 'Файл'}
          </span>
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-300">
          {isEn ? 'Open' : 'Открыть'}
        </span>
      </a>
    );
  };

  if (!user) return null;

  return (
    <main className="app-page-bg relative min-h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[360px] w-[420px] -translate-x-1/2 rounded-full bg-blue-500/12 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-[320px] w-[300px] -translate-x-1/2 rounded-full bg-cyan-500/8 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-20 mix-blend-soft-light"
          style={{
            backgroundImage:
              'radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.05), transparent 50%), radial-gradient(1px 1px at 80% 0%, rgba(255,255,255,0.04), transparent 50%), radial-gradient(1px 1px at 50% 100%, rgba(255,255,255,0.03), transparent 50%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1360px] flex-col gap-4 px-4 py-5 lg:px-6">
        <div className={`hidden items-center gap-3 rounded-[30px] px-6 py-4 backdrop-blur-xl md:flex ${
          isDarkTheme
            ? 'bg-slate-900/88 shadow-[0_24px_50px_-34px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)]'
            : 'bg-white/85 shadow-[0_18px_40px_-30px_rgba(148,163,184,0.45)]'
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-5 w-5 text-slate-500 dark:text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
          </svg>
          <input
            className="w-full bg-transparent text-[15px] text-slate-900 placeholder:text-slate-500 outline-none dark:text-white"
            placeholder={isEn ? 'Search' : 'Поиск'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid min-h-[calc(100vh-7.5rem)] grid-cols-1 gap-5 md:grid-cols-[352px,1fr]">
        {/* Mobile header */}
        <div className={`flex items-center justify-between rounded-2xl p-3 backdrop-blur md:hidden ${
          isDarkTheme
            ? 'bg-slate-900/88 shadow-[0_24px_50px_-34px_rgba(0,0,0,0.8)]'
            : 'bg-white/85 shadow-[0_18px_40px_-30px_rgba(148,163,184,0.45)]'
        }`}>
          <div className="flex items-center gap-3">
            {renderAvatar({
              name: user?.name,
              email: user?.email,
              photo: profilePhoto,
              userId: user?.id,
              className: 'h-11 w-11 rounded-xl shadow-lg shadow-blue-500/20',
            })}
            <div>
              <div className="max-w-[140px] truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.name || user?.email}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{isEn ? 'Online' : 'Онлайн'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/profile" className="rounded-full bg-slate-900/5 px-3 py-1 text-slate-700 transition hover:bg-slate-900/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              {isEn ? 'Profile' : 'Профиль'}
            </Link>
            <button onClick={() => logout()} className="rounded-full bg-rose-500/8 px-3 py-1 text-rose-200 hover:bg-rose-500/12 transition">
              {isEn ? 'Logout' : 'Выход'}
            </button>
          </div>
        </div>

        {/* Chats list */}
        <section className={`flex flex-col overflow-hidden rounded-[34px] p-4 backdrop-blur-xl ${
          isDarkTheme
            ? 'bg-slate-900/88 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.78)]'
            : 'bg-white/72 shadow-[0_28px_70px_-42px_rgba(148,163,184,0.42)]'
        } ${(selected || selectedRoom) ? 'hidden md:flex' : 'flex'}`}>
          <div className={`flex min-h-full flex-col rounded-[28px] p-4 ${isDarkTheme ? 'bg-slate-950/52' : 'bg-slate-50/60'}`}>
            <div className={`mb-5 flex items-center gap-3 rounded-[20px] px-4 py-3.5 ${
              isDarkTheme
                ? 'bg-slate-900/72 shadow-[0_16px_34px_-30px_rgba(0,0,0,0.56)]'
                : 'bg-white/96 shadow-[0_14px_30px_-24px_rgba(148,163,184,0.32)]'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-5 w-5 text-slate-500 dark:text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
              </svg>
              <input
                className="w-full bg-transparent text-[15px] text-slate-900 placeholder:text-slate-500 outline-none dark:text-white"
                placeholder={isEn ? 'Search' : 'Поиск'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-1 flex-col">
              <div>
                <div className="mb-3 text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white">{isEn ? 'Direct Messages' : 'Личные сообщения'}</div>
                <div className="space-y-2.5">
                  {loading ? (
                    <p className="px-1 py-2 text-sm text-slate-400">{isEn ? 'Loading...' : 'Загрузка...'}</p>
                  ) : filteredConnections.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-slate-400">{isEn ? 'No contacts yet.' : 'Контактов пока нет.'}</p>
                  ) : (
                    filteredConnections.slice(0, 6).map((c) => (
                      (() => {
                        const isUnread = unreadDirectIds.includes(c.user.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelected(c);
                              setSelectedRoom(null);
                              markDirectAsRead(c.user.id);
                            }}
                            className={`w-full rounded-[20px] px-3.5 py-3.5 text-left transition ${
                              selected?.id === c.id
                                ? 'bg-[linear-gradient(180deg,rgba(82,104,245,0.22),rgba(33,48,102,0.16))] shadow-[0_18px_34px_-28px_rgba(79,70,229,0.38)]'
                                : isUnread
                                  ? 'bg-[linear-gradient(180deg,rgba(72,98,255,0.12),rgba(26,39,88,0.1))] shadow-[0_14px_28px_-24px_rgba(79,70,229,0.28)]'
                                  : isDarkTheme
                                    ? 'bg-slate-950/34 hover:bg-slate-900/52'
                                    : 'bg-white/88 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                {renderAvatar({
                                  name: c.user.name,
                                  email: c.user.email,
                                  photo: c.user.avatarUrl || (c.user.id === user?.id ? profilePhoto : null),
                                  userId: c.user.id,
                                  className: 'h-11 w-11 rounded-full',
                                })}
                                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-950" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{c.user.name || c.user.email}</div>
                                  {isUnread && <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]" />}
                                </div>
                                <div className={`truncate text-[13px] ${isUnread ? 'text-blue-700 dark:text-blue-200/90' : 'text-slate-500 dark:text-slate-300/80'}`}>{c.user.email}</div>
                              </div>
                              <div className={`shrink-0 text-[12px] ${isUnread ? 'text-blue-700 dark:text-blue-200/90' : 'text-slate-500 dark:text-slate-400/70'}`}>
                                {isUnread ? (isEn ? 'New' : 'Новое') : formatRelativeTime(undefined, now, isEn)}
                              </div>
                            </div>
                          </button>
                        );
                      })()
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsInviteAccordionOpen((prev) => !prev);
                  setError('');
                }}
                className={`mt-4 flex w-full items-center justify-between gap-3 rounded-[20px] px-4 py-3.5 text-left text-[15px] font-semibold transition ${
                  isDarkTheme
                    ? 'bg-slate-950/26 text-slate-100 shadow-[0_14px_30px_-28px_rgba(0,0,0,0.48)] hover:bg-slate-900/46'
                    : 'bg-white/82 text-slate-900 shadow-[0_12px_26px_-22px_rgba(148,163,184,0.24)] hover:bg-white'
                }`}
                aria-expanded={isInviteAccordionOpen}
                aria-controls="invite-accordion-panel"
              >
                <span>{isEn ? 'Invite People' : 'Пригласить людей'}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className={`h-5 w-5 text-slate-500 transition-transform dark:text-slate-300 ${isInviteAccordionOpen ? 'rotate-180' : 'rotate-0'}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              <div
                id="invite-accordion-panel"
                className={`grid overflow-hidden transition-all duration-300 ease-out ${
                  isInviteAccordionOpen ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="min-h-0">
                  <div
                    className={`rounded-[22px] p-3 transition-transform duration-300 ease-out ${
                      isDarkTheme
                        ? 'bg-slate-950/26 shadow-[0_14px_30px_-28px_rgba(0,0,0,0.48)]'
                        : 'bg-white/86 shadow-[0_12px_26px_-22px_rgba(148,163,184,0.24)]'
                    } ${
                      isInviteAccordionOpen ? 'translate-y-0' : '-translate-y-2'
                    }`}
                  >
                  <Button
                    type="button"
                    disabled={creatingLink}
                    loading={creatingLink}
                    onClick={createInviteLink}
                    fullWidth
                    className="mb-3 rounded-[18px] px-4 py-3 text-sm font-semibold"
                  >
                    {creatingLink ? (isEn ? 'Creating…' : 'Создаём…') : (isEn ? 'Create invite link' : 'Создать ссылку')}
                  </Button>
                  {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}
                  {inviteLink && (
                      <div className={`mb-3 rounded-[18px] p-3 ${isDarkTheme ? 'bg-slate-950/52' : 'bg-slate-100/80'}`}>
                      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">{isEn ? 'Invite link' : 'Ссылка'}</div>
                      <div className="break-all text-xs leading-5 text-slate-600 dark:text-slate-300">{inviteLink}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-slate-900/6 px-3 py-1.5 text-[11px] text-slate-700 transition hover:bg-slate-900/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/14"
                          onClick={async () => {
                            try {
                              await navigator.clipboard?.writeText(inviteLink);
                              setCopyStatus('success');
                            } catch {
                              setCopyStatus('failed');
                            }
                          }}
                        >
                          {isEn ? 'Copy' : 'Копировать'}
                        </button>
                        {copyStatus === 'success' && <span className="text-[11px] text-emerald-300">{isEn ? 'Copied' : 'Скопировано'}</span>}
                        {copyStatus === 'failed' && <span className="text-[11px] text-amber-300">{isEn ? 'Copy failed' : 'Ошибка копирования'}</span>}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-2">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/5 text-[11px] dark:bg-slate-800">◌</span>
                  <span>{isEn ? 'Rooms' : 'Комнаты'}</span>
                </div>
                {rooms.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-slate-400">{isEn ? 'No rooms yet.' : 'Комнат пока нет.'}</p>
                ) : (
                  <div className="space-y-2.5">
                    {rooms.map((r) => (
                      (() => {
                        const isUnread = unreadRoomIds.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            onClick={() => {
                              setSelected(null);
                              setSelectedRoom(r);
                              markRoomAsRead(r.id);
                            }}
                            className={`w-full rounded-[20px] px-3.5 py-3.5 text-left transition ${
                              selectedRoom?.id === r.id
                                ? 'bg-[linear-gradient(180deg,rgba(82,104,245,0.22),rgba(33,48,102,0.16))] shadow-[0_18px_34px_-28px_rgba(79,70,229,0.38)]'
                                : isUnread
                                  ? 'bg-[linear-gradient(180deg,rgba(72,98,255,0.12),rgba(26,39,88,0.1))] shadow-[0_14px_28px_-24px_rgba(79,70,229,0.28)]'
                                  : isDarkTheme
                                    ? 'bg-slate-950/34 hover:bg-slate-900/52'
                                    : 'bg-white/88 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-blue-500 text-base text-white">
                                {r.isOwner ? '✦' : '🔒'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{r.name}</div>
                                  {isUnread && <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]" />}
                                </div>
                                <div className={`truncate text-[13px] ${isUnread ? 'text-blue-700 dark:text-blue-200/90' : 'text-slate-500 dark:text-slate-300/80'}`}>
                                  {r.isOwner ? (isEn ? 'Your room' : 'Ваша комната') : (r.owner.name || r.owner.email)}
                                </div>
                              </div>
                              <div className={`shrink-0 text-[12px] ${isUnread ? 'text-blue-700 dark:text-blue-200/90' : 'text-slate-500 dark:text-slate-400/70'}`}>
                                {isUnread ? (isEn ? 'New' : 'Новое') : formatRelativeTime(r.joinedAt, now, isEn)}
                              </div>
                            </div>
                          </button>
                        );
                      })()
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1" />
            </div>
          </div>
        </section>

        {/* Chat panel */}
        <section className={`relative flex flex-col overflow-hidden rounded-[34px] backdrop-blur-2xl min-h-[560px] max-h-[calc(100vh-5rem)] ${
          isDarkTheme
            ? 'bg-slate-900/88 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.78)]'
            : 'bg-white/72 shadow-[0_28px_70px_-42px_rgba(148,163,184,0.42)]'
        } ${(selected || selectedRoom) ? 'flex' : 'hidden md:flex'}`}>
          {selected || selectedRoom ? (
            <div className={`mx-auto flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] ${isDarkTheme ? 'bg-slate-950/56' : 'bg-slate-50/62'}`}>
              <div className={`flex shrink-0 items-center gap-4 px-7 py-6 ${
                isDarkTheme
                  ? 'bg-slate-900/84 shadow-[0_16px_34px_-26px_rgba(0,0,0,0.62)]'
                  : 'bg-white/74 shadow-[0_16px_34px_-26px_rgba(148,163,184,0.26)]'
              }`}>
                {(selected || selectedRoom) && (
                  <button
                    type="button"
                    onClick={() => { setSelected(null); setSelectedRoom(null); }}
                    className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900/6 text-slate-900 hover:bg-slate-900/10 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    aria-label="Назад к списку"
                  >
                    ←
                  </button>
                )}
                {selectedRoom ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,rgba(255,215,64,0.12),rgba(255,255,255,0.03))] text-lg font-semibold text-amber-100 shadow-inner shadow-amber-200/10">
                    🔒
                  </div>
                ) : (
                  renderAvatar({
                    name: selected?.user.name,
                    email: selected?.user.email,
                    photo: selectedDirectPhoto,
                    userId: selected?.user.id,
                    className: 'h-12 w-12 rounded-[18px]',
                  })
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">{selectedName}</h3>
                  <p className="mt-1 flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-300/80">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.85)]" />
                    {selectedRoom ? (isEn ? 'Room chat' : 'Комната') : (isEn ? 'Direct conversation' : 'Личный диалог')}
                  </p>
                </div>
              </div>

              <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-8">
                <div className="mx-auto w-full max-w-[720px] space-y-6">
                  {isRoomChat ? (
                    loadingRoomMessages && roomMessages.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-400">{isEn ? 'Loading...' : 'Загрузка...'}</p>
                    ) : chatMessages.length === 0 ? (
                      <p className="py-10 text-center text-sm text-slate-400">{isEn ? 'This room is quiet for now. Write the first message.' : 'В этой комнате пока тихо. Напишите первое сообщение.'}</p>
                    ) : (
                      groupedMessages.map((group) => (
                        <div key={group.title} className="space-y-5">
                          <div className="flex justify-center pb-1">
                            <span className="inline-flex rounded-full bg-slate-900/5 px-4 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300/75">
                              {group.title}
                            </span>
                          </div>
                          {group.items.map((m, index) => {
                            const rm = m as RoomMessage;
                            const isSystemLeave = isRoomChat && rm.systemEventType === 'user_left';
                            if (isSystemLeave) {
                              const leaveName = rm.sender?.name || rm.sender?.email || (isEn ? 'A user' : 'Участник');
                              return (
                                <div key={m.id} className="flex justify-center py-2">
                                  <span className="rounded-full bg-slate-200/80 px-4 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-600/80 dark:text-slate-300">
                                    {isEn ? `${leaveName} left the room` : `${leaveName} покинул комнату`}
                                  </span>
                                </div>
                              );
                            }
                            const isMine = m.senderId === user.id;
                            const prev = group.items[index - 1];
                            const next = group.items[index + 1];
                            const isPrevSameSender = prev?.senderId === m.senderId;
                            const isNextSameSender = next?.senderId === m.senderId;
                            const senderName = rm.sender?.name || rm.sender?.email || '';
                            return (
                              <div key={m.id} className={`flex gap-2.5 ${isMine ? 'justify-end items-end' : 'justify-start items-end'} ${isPrevSameSender ? 'pt-0.5' : 'pt-4'}`}>
                                {!isMine && (
                                  isNextSameSender ? (
                                    <div className="h-9 w-9 shrink-0" />
                                  ) : (
                                    <div className="ring-2 ring-slate-200/80 dark:ring-slate-700/60 rounded-full shrink-0">
                                      {renderAvatar({
                                        name: rm.sender?.name,
                                        email: rm.sender?.email,
                                        photo: rm.sender?.avatarUrl,
                                        userId: rm.sender?.id,
                                        className: 'h-9 w-9',
                                      })}
                                    </div>
                                  )
                                )}
                                <div className={`${isMine ? 'ml-auto max-w-[80%]' : 'max-w-[80%]'} w-fit rounded-2xl px-4 py-2.5 shadow-sm ${
                                  isMine
                                    ? 'bg-indigo-500 text-white dark:bg-indigo-600'
                                    : 'bg-slate-100 text-slate-900 dark:bg-slate-700/90 dark:text-slate-100'
                                }`}>
                                  {!isMine && !isPrevSameSender && senderName && (
                                    <div className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{senderName}</div>
                                  )}
                                  {rm.attachmentUrl && (
                                    <div className="space-y-2">
                                      <div className={`text-[11px] font-medium ${isMine ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {isMediaType(rm.attachmentType) ? (isEn ? 'Photo/video' : 'Фото/видео') : (isEn ? 'File' : 'Файл')}
                                      </div>
                                      {renderAttachmentContent(rm)}
                                      {rm.attachmentName && (
                                        <div className={`break-all text-xs ${isMine ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                          {decodeAttachmentName(rm.attachmentName)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {m.text && <div className={`text-[15px] leading-[1.45] break-words ${rm.attachmentUrl ? 'mt-2' : ''}`}>{m.text}</div>}
                                  <div className={`mt-1 flex items-center gap-2 text-[11px] ${isMine ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                    <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isMine && <MessageStatus status="sent" className="text-white/80" />}
                                  </div>
                                </div>
                                {isMine && (
                                  isNextSameSender ? (
                                    <div className="h-9 w-9 shrink-0" />
                                  ) : (
                                    <div className="ring-2 ring-indigo-200/60 dark:ring-indigo-900/50 rounded-full shrink-0">
                                      {renderAvatar({
                                        name: user?.name,
                                        email: user?.email,
                                        photo: profilePhoto,
                                        userId: user?.id,
                                        className: 'h-9 w-9',
                                      })}
                                    </div>
                                  )
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )
                  ) : loadingMessages && messages.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">{isEn ? 'Loading...' : 'Загрузка...'}</p>
                  ) : chatMessages.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-400">{isEn ? 'No messages yet. Write the first message.' : 'Сообщений пока нет. Напишите первое сообщение.'}</p>
                  ) : (
                    groupedMessages.map((group) => (
                      <div key={group.title} className="space-y-5">
                        <div className="flex justify-center pb-1">
                            <span className="inline-flex rounded-full bg-slate-900/5 px-4 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300/75">
                            {group.title}
                          </span>
                        </div>
                        {group.items.map((m, index) => {
                          const isMine = m.senderId === user.id;
                          const prev = group.items[index - 1];
                          const next = group.items[index + 1];
                          const isPrevSameSender = prev?.senderId === m.senderId;
                          const isNextSameSender = next?.senderId === m.senderId;
                          return (
                            <div key={m.id} className={`flex gap-2.5 ${isMine ? 'justify-end items-end' : 'justify-start items-end'} ${isPrevSameSender ? 'pt-0.5' : 'pt-4'}`}>
                              {!isMine && (
                                isNextSameSender ? (
                                  <div className="h-9 w-9 shrink-0" />
                                ) : (
                                  <div className="ring-2 ring-slate-200/80 dark:ring-slate-600/50 rounded-full shrink-0">
                                    {renderAvatar({
                                      name: selected?.user.name,
                                      email: selected?.user.email,
                                      photo: selected?.user.avatarUrl,
                                      userId: selected?.user.id,
                                      className: 'h-9 w-9',
                                    })}
                                  </div>
                                )
                              )}
                              <div className={`group relative ${isMine ? 'ml-auto max-w-[80%]' : 'max-w-[80%]'} w-fit rounded-2xl px-4 py-2.5 shadow-sm ${
                                isMine
                                  ? 'bg-indigo-500 text-white dark:bg-indigo-600'
                                  : 'bg-slate-100 text-slate-900 dark:bg-slate-700/90 dark:text-slate-100'
                              }`}>
                                <button
                                  type="button"
                                  onClick={() => void deleteDirectMessage(m.id)}
                                  disabled={deletingMessageId === m.id}
                                  className="absolute right-2 top-2 rounded-full bg-black/5 px-2 py-1 text-[11px] text-slate-500 opacity-100 transition hover:bg-rose-500/15 hover:text-rose-600 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-rose-500/25 md:opacity-0 md:group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-100"
                                  aria-label={isEn ? 'Delete message' : 'Удалить сообщение'}
                                  title={isEn ? 'Delete message' : 'Удалить сообщение'}
                                >
                                  {deletingMessageId === m.id ? (isEn ? '...' : '...') : '×'}
                                </button>
                                {(m as Message).attachmentUrl && (
                                  <div className="space-y-2">
                                    <div className={`text-[11px] font-medium ${isMine ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                      {isMediaType((m as Message).attachmentType) ? 'Фото/видео' : 'Файл'}
                                    </div>
                                    {renderAttachmentContent(m as Message)}
                                    {(m as Message).attachmentName && (
                                      <div className={`break-all text-xs ${isMine ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {decodeAttachmentName((m as Message).attachmentName)}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {m.text && <div className={`text-[15px] leading-[1.45] break-words ${(m as Message).attachmentUrl ? 'mt-2' : ''}`}>{m.text}</div>}
                                <div className={`mt-1 flex items-center gap-2 text-[11px] ${isMine ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {isMine && <MessageStatus status="sent" className="text-white/80" />}
                                </div>
                              </div>
                              {isMine && (
                                isNextSameSender ? (
                                  <div className="h-9 w-9 shrink-0" />
                                ) : (
                                  <div className="ring-2 ring-indigo-200/60 dark:ring-indigo-900/50 rounded-full shrink-0">
                                    {renderAvatar({
                                      name: user?.name,
                                      email: user?.email,
                                      photo: profilePhoto,
                                      userId: user?.id,
                                      className: 'h-9 w-9',
                                    })}
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <form onSubmit={sendMessage} className={`shrink-0 px-7 py-5 ${
                isDarkTheme
                  ? 'bg-slate-900/84 shadow-[0_-14px_30px_-28px_rgba(0,0,0,0.62)]'
                  : 'bg-white/74 shadow-[0_-14px_30px_-28px_rgba(148,163,184,0.24)]'
              }`}>
                <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
                  {attachment && (
                    <div className="flex items-center justify-between gap-3 rounded-[20px] bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_12px_24px_-20px_rgba(148,163,184,0.32)] dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_14px_28px_-22px_rgba(0,0,0,0.72)]">
                      <div className="flex min-w-0 items-center gap-3">
                        {attachment.type === 'media' && attachment.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={attachment.preview}
                            alt={attachment.name}
                            className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-xs font-semibold text-blue-700 dark:text-blue-200">
                            {attachment.name.includes('.') ? attachment.name.split('.').pop()?.slice(0, 4).toUpperCase() : 'FILE'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{decodeAttachmentName(attachment.name)}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-300">
                            {attachment.type === 'media' ? (isEn ? 'Photo or video' : 'Фото/видео') : (isEn ? 'File' : 'Файл')}
                            {attachment.size ? ` • ${formatFileSize(attachment.size)}` : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearAttachment}
                        className="shrink-0 rounded-full bg-slate-900/6 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-900/10 hover:text-slate-900 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1] dark:hover:text-white"
                      >
                        {isEn ? 'Remove' : 'Убрать'}
                      </button>
                    </div>
                  )}
                  <div className="relative flex items-center gap-3 rounded-[24px] bg-white/96 px-4 py-3.5 text-slate-900 shadow-[0_16px_34px_-24px_rgba(148,163,184,0.34)] dark:bg-slate-950/40 dark:text-slate-50 dark:shadow-[0_18px_36px_-26px_rgba(0,0,0,0.58)]">
                    <div ref={attachMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAttach((v) => !v)}
                        className="rounded-full p-2 text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label={isEn ? 'Attach file or photo' : 'Прикрепить файл или фото'}
                        title={isEn ? 'Attach photo or file' : 'Прикрепить фото или файл'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 8.25v7.5a2.25 2.25 0 0 0 4.5 0V7.5a3.75 3.75 0 1 0-7.5 0v8.25a5.25 5.25 0 0 0 10.5 0V9" />
                        </svg>
                      </button>

                      {showAttach && (
                        <div className="absolute bottom-full left-0 mb-3 w-56 rounded-[18px] bg-white py-2 text-sm text-slate-900 shadow-2xl dark:bg-slate-950/95 dark:text-slate-100">
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-2 transition hover:bg-slate-900/5 dark:hover:bg-slate-800"
                            onClick={() => mediaInputRef.current?.click()}
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/6 text-[11px] dark:bg-slate-800">
                              +
                            </span>
                            Фото или видео
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-2 transition hover:bg-slate-900/5 dark:hover:bg-slate-800"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/6 text-[11px] dark:bg-slate-800">
                              +
                            </span>
                            Файл
                          </button>
                        </div>
                      )}
                    </div>

                    <input
                      className="flex-1 bg-transparent text-[15px] placeholder:text-slate-500 outline-none"
                      value={messageText}
                      onChange={(e) => {
                        setMessageText(e.target.value);
                        if (!isRoomChat) {
                          setIsTyping(true);
                          setTimeout(() => setIsTyping(false), 1500);
                        }
                      }}
                      placeholder={isRoomChat ? (isEn ? 'Message to room...' : 'Сообщение в комнату...') : (isEn ? 'Message...' : 'Сообщение...')}
                    />

                    <Button type="submit" className="h-12 rounded-full px-6 text-sm font-semibold">
                      {isEn ? 'Send' : 'Отправить'}
                    </Button>
                  </div>
                  <>
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePick(file, 'media');
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePick(file, 'file');
                        e.target.value = '';
                      }}
                    />
                  </>
                </div>
              </form>
            </div>
          ) : (
            <div className="relative flex h-full items-center justify-center overflow-hidden px-6 py-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(99,102,241,0.26),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.12),transparent_30%)]" />
              <div
                className="absolute inset-0 opacity-35"
                style={{
                  backgroundImage:
                    'radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,0.12), transparent 55%), radial-gradient(1px 1px at 74% 26%, rgba(255,255,255,0.12), transparent 55%), radial-gradient(1px 1px at 38% 72%, rgba(255,255,255,0.08), transparent 55%), radial-gradient(1px 1px at 82% 82%, rgba(255,255,255,0.08), transparent 55%)',
                }}
              />
              <div className={`relative mx-auto flex w-full max-w-[440px] flex-col items-center justify-center rounded-[32px] px-10 py-20 text-center ${
                isDarkTheme
                  ? 'bg-transparent shadow-none'
                  : 'bg-white/44 shadow-[0_18px_40px_-34px_rgba(148,163,184,0.18)]'
              }`}>
                <div className="app-empty-state w-full rounded-[24px]">
                  <EmptyState
                    icon="💬"
                    title={isEn ? 'Select a conversation' : 'Выберите диалог'}
                    description={
                      isEn
                        ? 'Open contacts or rooms to start messaging.'
                        : 'Откройте контакты или комнаты, чтобы начать переписку.'
                    }
                    action={
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Button type="button" onClick={() => router.push('/contacts')} className="rounded-full px-8">
                          {isEn ? 'Contacts' : 'Контакты'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => router.push('/rooms')} className="rounded-full px-8">
                          {isEn ? 'Rooms' : 'Комнаты'}
                        </Button>
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      </div>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
