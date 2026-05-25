import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth';

function initials(name?: string | null, email?: string): string {
  if (name?.trim()) return name.trim().slice(0, 2).toUpperCase();
  return (email?.[0] ?? '?').toUpperCase();
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void logout().then(() => router.replace('/auth/login'));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.content}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials(user?.name, user?.email)}</Text>
        </View>
        <Text style={s.name}>{user?.name ?? user?.email}</Text>
        {user?.name && <Text style={s.email}>{user.email}</Text>}
        <View style={s.badge}>
          <Text style={s.badgeText}>{user?.plan ?? 'FREE'}</Text>
        </View>
      </View>
      <View style={s.actions}>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  content: { alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  email: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  badge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  badgeText: { color: '#818cf8', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  actions: { paddingHorizontal: 24, marginTop: 'auto', paddingBottom: 32 },
  logoutBtn: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: { color: '#f87171', fontSize: 16, fontWeight: '600' },
});
