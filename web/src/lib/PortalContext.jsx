import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { api } from './api';

const PortalContext = createContext(null);

export function PortalProvider({ children }) {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { business } = await api.portalMe();
      setBusiness(business);
    } catch {
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
