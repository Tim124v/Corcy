'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLanguage = 'ru' | 'en';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
};

const STORAGE_KEY = 'connexy-lang';

const LanguageContext = createContext<LanguageContextValue>({
  language: 'ru',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('ru');

  useEffect(() => {
    const stored = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as AppLanguage | null;
    const next = stored === 'en' ? 'en' : 'ru';
    setLanguageState(next);
    document.documentElement.lang = next;
  }, []);

  const setLanguage = (next: AppLanguage) => {
    setLanguageState(next);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  };

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
