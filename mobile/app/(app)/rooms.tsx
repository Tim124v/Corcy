import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RoomsScreen() {
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Text style={s.title}>Комнаты</Text>
      <Text style={s.sub}>Скоро…</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  sub: { fontSize: 14, color: '#475569', marginTop: 8 },
});
