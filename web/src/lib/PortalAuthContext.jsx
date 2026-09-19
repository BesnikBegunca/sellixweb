import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

// Deliberately separate from AuthContext: the two sessions use different
// cookies, and an admin signed in on the same browser must not appear to be
// signed in to a shop's portal (or the reverse).
const PortalAuthContext = createContext(null);

export function PortalAuthProvider({ children }) {
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
    <PortalAuthContext.Provider value={{ business, loading, login, logout, refresh, setBusiness }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
  return ctx;
}
