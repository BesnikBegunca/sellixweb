import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { api, openStream } from './api';

const PortalContext = createContext(null);

export function PortalProvider({ children }) {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const booted = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.portalMe();
      const next = data.business;
      setBusiness((prev) => {
        if (!next) return next;
        // A request that left before admin clicked notify must not wipe the
        // live flag the SSE just set — otherwise the popup flashes off.
        if (prev?.licenseNoticeAt && !next.licenseNoticeAt) {
          return { ...next, licenseNoticeAt: prev.licenseNoticeAt };
        }
        return next;
      });
      return next;
    } catch {
      if (!booted.current) setBusiness(null);
      return null;
    } finally {
      booted.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!business?.id) return undefined;

    const source = openStream('/portal/stream');
    const onPush = () => {
      refresh();
    };
    const onRenewal = () => {
      setBusiness((prev) => (prev ? { ...prev, licenseNoticeAt: prev.licenseNoticeAt || new Date().toISOString() } : prev));
      refresh();
    };
    if (source) {
      source.addEventListener('sales', onPush);
      source.addEventListener('renewal', onRenewal);
      source.onmessage = onPush;
    }

    const poll = setInterval(refresh, 2000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      if (source) {
        source.removeEventListener('sales', onPush);
        source.removeEventListener('renewal', onRenewal);
        source.onmessage = null;
        source.close();
      }
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [business?.id, refresh]);

  const login = async (email, password) => {
    const { business } = await api.portalLogin(email, password);
    setBusiness(business);
    return business;
  };

  const logout = async () => {
    await api.portalLogout();
    setBusiness(null);
  };

  return (
    <PortalContext.Provider value={{ business, loading, login, logout, refresh, setBusiness }}>
      {children ?? <Outlet />}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used within PortalProvider');
  return ctx;
}
