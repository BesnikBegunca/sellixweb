import { useEffect, useRef, useState } from 'react';
import { openStream } from './api';

// How stale the data is allowed to get. The stream normally beats both of
// these — they are the fallback for a proxy that eats SSE, a sleeping laptop,
// or an event that never arrived.
const POLL_MS = 6000;
const POLL_WITH_STREAM_MS = 45000;
const TICK_MS = 1500;

// Runs `load` on mount and on every deps change, then keeps it running: once
// per push from the server, plus a poll so the page can never sit on stale
// numbers. A hidden tab stops refetching and catches up when it comes back.
export function useLiveRefresh(load, { deps = [], stream } = {}) {
  const loadRef = useRef(load);
  loadRef.current = load;

  const [lastUpdated, setLastUpdated] = useState(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let queued = false;
    let startedAt = 0;
    let connected = false;
    let source = null;

    const run = () => {
      if (cancelled) return;
      // A push during a refetch must not be lost, and must not open a second
      // one — remember it and run again as soon as this one lands.
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      startedAt = Date.now();
      Promise.resolve(loadRef.current())
        .then(() => {
          if (!cancelled) setLastUpdated(new Date());
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
          if (cancelled) return;
          if (queued) {
            queued = false;
            run();
          }
        });
    };

    const runIfVisible = () => {
      if (document.visibilityState !== 'hidden') run();
    };

    run();

    const tick = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const gap = connected ? POLL_WITH_STREAM_MS : POLL_MS;
      if (Date.now() - startedAt >= gap) run();
    }, TICK_MS);

    if (stream) {
      source = openStream(stream);
      if (source) {
        source.addEventListener('ready', () => {
          if (cancelled) return;
          connected = true;
          setLive(true);
        });
        // The event says only that this business has new sales; the payload we
        // render still comes from the normal endpoints.
        source.addEventListener('sales', runIfVisible);
        source.onerror = () => {
          if (cancelled) return;
          connected = false;
          setLive(false);
          // EventSource reconnects on its own; the faster poll covers the gap.
        };
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', runIfVisible);
    window.addEventListener('online', runIfVisible);

    return () => {
      cancelled = true;
      clearInterval(tick);
      if (source) {
        source.onerror = null;
        source.close();
      }
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', runIfVisible);
      window.removeEventListener('online', runIfVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, ...deps]);

  return { lastUpdated, live };
}

export function liveClock(date) {
  if (!date) return '';
  return date.toLocaleTimeString('sq-XK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
