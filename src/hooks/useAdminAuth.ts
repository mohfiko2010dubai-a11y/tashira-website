import { useState, useEffect } from 'react';

const ADMIN_AUTH_KEY = 'tashira_admin_auth';

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = localStorage.getItem(ADMIN_AUTH_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

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
