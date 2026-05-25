import { useState } from 'react';
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
import { API_URL } from '../../constants/api';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim() || undefined,
          inviteToken: inviteToken.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; needVerification?: boolean; email?: string };

      if (!data.ok) {
        setError(data.error ?? 'Ошибка регистрации');
        return;
      }

      router.push({
        pathname: '/auth/verify-email',
        params: { email: data.email ?? email.trim().toLowerCase() },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Регистрация</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TextInput
          style={s.input}
          placeholder="Имя (необязательно)"
          placeholderTextColor="#64748b"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={s.input}
          placeholder="Пароль"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={s.input}
          placeholder="Код приглашения"
          placeholderTextColor="#64748b"
          value={inviteToken}
          onChangeText={setInviteToken}
          autoCapitalize="none"
        />

        <TouchableOpacity style={s.btn} onPress={() => void handleRegister()} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Создать аккаунт</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={s.link}>
          <Text style={s.linkText}>Уже есть аккаунт? Войти</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', textAlign: 'center', marginBottom: 32 },
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
