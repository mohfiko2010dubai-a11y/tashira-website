import { useState } from 'react';

const ADMIN_AUTH_KEY = 'tashira_admin_auth';

export function useAdminAuth() {
  // Read localStorage synchronously in initial state (no async gap)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
  });
  const isLoading = false; // Sync read — no loading delay

  const login = (password: string): boolean => {
    // Admin password from env - in production this should be server-side
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'tashira2025';
    if (password === adminPassword) {
      localStorage.setItem(ADMIN_AUTH_KEY, 'true');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    setIsAuthenticated(false);
  };

  return { isAuthenticated, isLoading, login, logout };
}
