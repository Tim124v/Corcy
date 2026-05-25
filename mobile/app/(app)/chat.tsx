import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { connectSocket } from '../../store/socket';

type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
};

export default function ChatScreen() {
  const { peerId, peerName } = useLocalSearchParams<{ peerId?: string; peerName?: string }>();
  const { user, accessToken } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!peerId) return;
    try {
      const data = await api<{ messages: Message[] }>(`/messages?with=${peerId}&limit=50`);
      setMessages(data.messages);
    } catch {
      /* skip */
    }
  }, [peerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken || !peerId) return;
    const socket = connectSocket(accessToken);

    const onNew = (data: unknown) => {
      const msg = data as Message & { receiverId?: string };
      if (msg.senderId === peerId || msg.senderId === user?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on('newDirectMessage', onNew);
    return () => {
      socket.off('newDirectMessage', onNew);
    };
  }, [accessToken, peerId, user?.id]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || !peerId || sending) return;
    setSending(true);
    try {
      const msg = await api<Message>('/messages', {
        method: 'POST',
        body: JSON.stringify({ receiverId: peerId, text: trimmed }),
      });
      setMessages((prev) => [...prev, msg]);
      setText('');
    } catch {
      /* skip */
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {peerName ?? 'Чат'}
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const isMine = item.senderId === user?.id;
          return (
            <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
              <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>{item.text}</Text>
            </View>
          );
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Сообщение…"
            placeholderTextColor="#475569"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={s.sendBtn} onPress={() => void send()} disabled={sending}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  back: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#f1f5f9', flex: 1 },
  list: { padding: 16, gap: 8 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#4f46e5' },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#1e293b' },
  bubbleText: { fontSize: 15, color: '#e2e8f0' },
  bubbleTextMine: { color: '#fff' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
