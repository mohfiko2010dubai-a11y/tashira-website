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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STAFF_AUTH_KEY));
  const [sessionStaff, setSessionStaff] = useState<StaffUser | null>(null);
  const logoutMutation = trpc.staff.logout.useMutation();

  const verifyQuery = trpc.staff.verify.useQuery(
    { token: token || '' },
    { enabled: !!token, retry: false }
  );

  // Keep invalid persisted sessions from surviving the next page load.
  useEffect(() => {
    if (verifyQuery.isError) {
      localStorage.removeItem(STAFF_AUTH_KEY);
    }
  }, [verifyQuery.isError]);

  const staff = sessionStaff ?? verifyQuery.data ?? null;

  const login = (newToken: string, staffData: StaffUser) => {
    localStorage.setItem(STAFF_AUTH_KEY, newToken);
    setToken(newToken);
    setSessionStaff(staffData);
  };

  const logout = () => {
    localStorage.removeItem(STAFF_AUTH_KEY);
    setToken(null);
    setSessionStaff(null);
    // Call server logout in background
    if (token) {
      logoutMutation.mutate({ token });
    }
    window.location.href = '/staff/login';
  };

  const isLoading = verifyQuery.isLoading && !!token && !sessionStaff;

  return {
    isAuthenticated: !!staff,
    isLoading,
    staff,
    token,
    login,
    logout,
  };
}
