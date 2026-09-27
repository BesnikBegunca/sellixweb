import { useCallback, useEffect, useState } from 'react';

const KEY = 'sellix-portal-theme';
const BG = { light: '#F1F3F5', dark: '#0C110F' };

// The portal remembers its own light/dark choice; first visit follows the phone.
export function readPortalTheme() {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function usePortalTheme() {
  const [theme, setTheme] = useState(readPortalTheme);

  // Keep the document background (overscroll, safe areas, status bar) in step.
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
    const els = [document.documentElement, document.body, document.getElementById('root')].filter(Boolean);
    els.forEach((el) => { el.style.background = BG[theme]; });
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content');
    meta?.setAttribute('content', BG[theme]);
    return () => {
      els.forEach((el) => { el.style.background = ''; });
      if (meta && prev) meta.setAttribute('content', prev);
    };
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return [theme, toggle];
}
