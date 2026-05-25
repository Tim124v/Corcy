import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { connectSocket } from '../../store/socket';

type Connection = {
  id: string;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
};

type LastMessage = { text: string; createdAt: string; senderId: string };

function initials(name?: string | null, email?: string): string {
  if (name?.trim()) return name.trim().slice(0, 2).toUpperCase();
  return (email?.[0] ?? '?').toUpperCase();
}

export default function DashboardScreen() {
  const { user, accessToken } = useAuthStore();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({});
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const data = await api<Connection[]>('/connections');
      setConnections(data);

      const previews: Record<string, LastMessage> = {};
      await Promise.allSettled(
        data.map(async (c) => {
          try {
            const thread = await api<{ messages: LastMessage[] }>(
              `/messages?with=${c.user.id}&limit=1`,
            );
            const last = thread.messages[0];
            if (last) previews[c.user.id] = last;
          } catch {
            /* skip */
          }
        }),
      );
      setLastMessages(previews);
    } catch {
      /* skip */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken) return;
    const socket = connectSocket(accessToken);

    socket.on('newDirectMessage', (data: unknown) => {
      const msg = data as { senderId: string; text: string; createdAt: string };
      setUnread((prev) => ({ ...prev, [msg.senderId]: true }));
      setLastMessages((prev) => ({
        ...prev,
        [msg.senderId]: { text: msg.text, createdAt: msg.createdAt, senderId: msg.senderId },
      }));
    });

    return () => {
      socket.off('newDirectMessage');
    };
  }, [accessToken]);

  const filtered = search.trim()
    ? connections.filter(
        (c) =>
          (c.user.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
          c.user.email.toLowerCase().includes(search.toLowerCase()),
      )
    : connections;

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Сообщения</Text>
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Поиск контактов…"
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#6366f1" />
        }
        renderItem={({ item }) => {
          const last = lastMessages[item.user.id];
          const hasUnread = unread[item.user.id];
          return (
            <TouchableOpacity
              style={s.row}
              onPress={() => {
                setUnread((prev) => {
                  const n = { ...prev };
                  delete n[item.user.id];
                  return n;
                });
                router.push({
                  pathname: '/(app)/chat',
                  params: {
                    peerId: item.user.id,
                    peerName: item.user.name ?? item.user.email,
                  },
                });
              }}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials(item.user.name, item.user.email)}</Text>
              </View>
              <View style={s.rowContent}>
                <View style={s.rowTop}>
                  <Text style={s.name} numberOfLines={1}>
                    {item.user.name ?? item.user.email}
                  </Text>
                  {last && (
                    <Text style={s.time}>
                      {new Date(last.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
                <View style={s.rowBottom}>
                  <Text style={[s.preview, hasUnread && s.previewUnread]} numberOfLines={1}>
                    {last
                      ? last.senderId === user?.id
                        ? `Вы: ${last.text}`
                        : last.text
                      : 'Нет сообщений'}
                  </Text>
                  {hasUnread && <View style={s.dot} />}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={s.empty}>{search ? 'Не найдено' : 'Нет контактов'}</Text>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#f1f5f9' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  search: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', flex: 1 },
  time: { fontSize: 12, color: '#475569', marginLeft: 8 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { fontSize: 13, color: '#64748b', flex: 1 },
  previewUnread: { color: '#94a3b8', fontWeight: '500' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1', marginLeft: 8 },
  empty: { textAlign: 'center', color: '#475569', marginTop: 48, fontSize: 15 },
});
