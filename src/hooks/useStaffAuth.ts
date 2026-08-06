import { useState, useEffect } from 'react';
import { trpc } from '@/providers/trpc-client';

const STAFF_AUTH_KEY = 'tashira_staff_auth';

interface StaffUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export function useStaffAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const verifyQuery = trpc.staff.verify.useQuery(
    { token: token || '' },
    { enabled: !!token, retry: false }
  );

  // Load token from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STAFF_AUTH_KEY);
    if (saved) {
      setToken(saved);
    } else {
      // No token in localStorage, auth check is done
      setInitialCheckDone(true);
    }
  }, []);

  // When verify query finishes (success or error), mark initial check as done
  useEffect(() => {
    if (!token) return;
    if (verifyQuery.isSuccess || verifyQuery.isError) {
      setInitialCheckDone(true);
    }
  }, [verifyQuery.isSuccess, verifyQuery.isError, token]);

  // Update staff state when verify query returns data
  useEffect(() => {
    if (verifyQuery.data) {
      setStaff(verifyQuery.data);
    } else if (verifyQuery.isError) {
      // Token invalid, clear it
      localStorage.removeItem(STAFF_AUTH_KEY);
      setToken(null);
      setStaff(null);
    }
  }, [verifyQuery.data, verifyQuery.isError]);

  const login = (newToken: string, staffData: StaffUser) => {
    localStorage.setItem(STAFF_AUTH_KEY, newToken);
    setToken(newToken);
    setStaff(staffData);
  };

  const logout = () => {
    localStorage.removeItem(STAFF_AUTH_KEY);
    setToken(null);
    setStaff(null);
    // Call server logout in background
    if (token) {
      try {
        trpc.staff.logout.useMutation().mutate({ token });
      } catch {
        // ignore
      }
    }
    window.location.href = '/staff/login';
  };

  // Loading: true if initial check not done, OR verify query is loading
  const isLoading = !initialCheckDone || (verifyQuery.isLoading && !!token);

  return {
    isAuthenticated: !!staff,
    isLoading,
    staff,
    token,
    login,
    logout,
  };
}
