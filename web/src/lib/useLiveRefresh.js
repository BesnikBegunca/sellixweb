import { useEffect, useRef } from 'react';

const LIVE_MS = 3000;

export function useLiveRefresh(load, deps = []) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const run = () => {
      if (cancelled || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      Promise.resolve(loadRef.current())
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    };

    run();
    const tick = setInterval(run, LIVE_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', run);
    return () => {
      cancelled = true;
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', run);
    };
  }, deps);
}

export function liveClock() {
  return new Date().toLocaleTimeString('sq-XK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
