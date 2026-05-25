import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/auth';
import { connectSocket, disconnectSocket } from '../store/socket';

export default function RootLayout() {
  const { accessToken, hydrated, tryRestoreSession } = useAuthStore();

  useEffect(() => {
    void tryRestoreSession();
  }, [tryRestoreSession]);

  useEffect(() => {
    if (accessToken) {
      connectSocket(accessToken);
    } else {
      disconnectSocket();
    }
    return () => {};
  }, [accessToken]);

  if (!hydrated) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
