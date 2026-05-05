import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Corsy',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
