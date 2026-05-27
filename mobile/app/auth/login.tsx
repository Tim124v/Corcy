import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { API_URL } from '../../constants/api';
import { initializeE2EStandalone, stashPasswordForE2E } from '../../hooks/use-e2e';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        accessToken?: string;
        refreshToken?: string;
        requiresTwoFactor?: boolean;
        tempToken?: string;
        user?: Parameters<typeof setAuth>[0];
      };

      if (!data.ok) {
        setError(data.error ?? 'Ошибка входа');
        return;
      }

      if (data.requiresTwoFactor && data.tempToken) {
        stashPasswordForE2E(passwordRef.current);
        router.push({ pathname: '/auth/two-factor', params: { tempToken: data.tempToken } });
        return;
      }

      if (data.accessToken && data.refreshToken && data.user) {
        await setAuth(data.user, data.accessToken, data.refreshToken);
        void initializeE2EStandalone(data.user.id, passwordRef.current).catch(() => {});
        router.replace('/(app)/dashboard');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>CORSY</Text>
        <Text style={s.subtitle}>Приватный мессенджер</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={s.input}
          placeholder="Пароль"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            passwordRef.current = text;
          }}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity style={s.btn} onPress={() => void handleLogin()} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Войти</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/auth/register')} style={s.link}>
          <Text style={s.linkText}>Нет аккаунта? Зарегистрироваться</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: { fontSize: 13, color: '#6366f1', letterSpacing: 3, textAlign: 'center', marginBottom: 48 },
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
  },
  btn: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#6366f1', fontSize: 14 },
});
