import { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { API_URL } from '../../constants/api';

export default function TwoFactorScreen() {
  const { tempToken } = useLocalSearchParams<{ tempToken?: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();

  const handleSubmit = async () => {
    if (!tempToken) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/2fa/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
        body: JSON.stringify({ tempToken, totpCode: code.trim() }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        accessToken?: string;
        refreshToken?: string;
        user?: Parameters<typeof setAuth>[0];
      };

      if (!data.ok || !data.accessToken || !data.refreshToken || !data.user) {
        setError(data.error ?? 'Неверный код');
        return;
      }

      await setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace('/(app)/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Двухфакторная аутентификация</Text>
        <Text style={s.hint}>Введите код из приложения-аутентификатора</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TextInput
          style={s.input}
          placeholder="000000"
          placeholderTextColor="#64748b"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity style={s.btn} onPress={() => void handleSubmit()} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Продолжить</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', textAlign: 'center', marginBottom: 8 },
  hint: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 32 },
  error: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    color: '#f87171',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    fontSize: 13,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: '#f1f5f9',
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: '#0f172a',
    textAlign: 'center',
    letterSpacing: 8,
  },
  btn: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
