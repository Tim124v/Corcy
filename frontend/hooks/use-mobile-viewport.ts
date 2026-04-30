'use client';

import { useEffect } from 'react';

export function useMobileViewport() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    const update = () => {
      // visualViewport.height = высота экрана МИНУС клавиатура
      // Именно это нужно чтобы инпут сидел вплотную к клавиатуре
      const height = window.visualViewport?.height ?? window.innerHeight;
      const offsetTop = window.visualViewport?.offsetTop ?? 0;

      root.style.setProperty('--vh', `${height * 0.01}px`);
      root.style.setProperty('--vp-height', `${height}px`);
      root.style.setProperty('--vp-offset', `${offsetTop}px`);
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

