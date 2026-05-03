'use client';

import { useEffect } from 'react';

export function useMobileViewport() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    const update = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty('--vp-height', `${height}px`);
    };

    update();

    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
}

