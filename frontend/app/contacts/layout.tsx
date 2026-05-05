import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Corsy',
};

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
