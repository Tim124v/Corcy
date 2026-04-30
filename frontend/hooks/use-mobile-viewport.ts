'use client';

import { useEffect } from 'react';

export function useMobileViewport() {
  useEffect(() => {
    const setVh = () => {
      const vh = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVh();

    window.visualViewport?.addEventListener('resize', setVh);
    window.visualViewport?.addEventListener('scroll', setVh);
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);

    return () => {
      window.visualViewport?.removeEventListener('resize', setVh);
      window.visualViewport?.removeEventListener('scroll', setVh);
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);
}

