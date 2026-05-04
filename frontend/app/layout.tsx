import './globals.css';
import type { Metadata } from 'next';
import appleSplash from '@/lib/apple-splash.json';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Contacts',
  description: 'Simple contacts and invites',
  icons: {
    icon: [{ url: '/connexy_favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Connexy" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="application-name" content="Connexy" />

        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {appleSplash.map((entry) => (
          <link
            key={entry.href}
            rel="apple-touch-startup-image"
            href={entry.href}
            media={entry.media}
          />
        ))}
      </head>
      <body className="min-h-screen overflow-x-hidden bg-gray-50 text-gray-900 dark:bg-slate-900 dark:text-slate-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}


