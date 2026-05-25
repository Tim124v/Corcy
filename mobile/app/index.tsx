import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/auth';

export default function Index() {
  const { user, hydrated } = useAuthStore();
  if (!hydrated) return null;
  return <Redirect href={user ? '/(app)/dashboard' : '/auth/login'} />;
}
