'use client';

import type React from 'react';
import { ThemeProvider } from '../components/theme-provider';
import { LanguageProvider } from '../components/language-provider';
import { AppLayout } from '../components/layout/AppLayout';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppLayout>{children}</AppLayout>
      </LanguageProvider>
    </ThemeProvider>
  );
}
