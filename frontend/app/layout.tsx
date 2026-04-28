import './globals.css';
import type { Metadata } from 'next';
import Providers from './providers';
import { SocketProvider } from '../components/socket-provider';

export const metadata: Metadata = {
  title: 'Contacts',
  description: 'Simple contacts and invites',
  icons: {
    icon: [{ url: '/connexy_favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-900 dark:text-slate-50">
        <Providers>
          <SocketProvider />
          {children}
        </Providers>
      </body>
    </html>
  );
}


