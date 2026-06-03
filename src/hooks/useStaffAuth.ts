import { useState, useEffect } from 'react';
import { trpc } from '@/providers/trpc';

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
  const [isLoading, setIsLoading] = useState(true);

  const verifyQuery = trpc.staff.verify.useQuery(
    { token: token || '' },
    { enabled: !!token, retry: false }
  );

  // Load token from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STAFF_AUTH_KEY);
    if (saved) {
      setToken(saved);
    }
    setIsLoading(false);
  }, []);

  // Update staff state when verify query returns
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
    // Call server logout
    if (token) {
      trpc.staff.logout.useMutation().mutate({ token });
    }
    localStorage.removeItem(STAFF_AUTH_KEY);
    setToken(null);
    setStaff(null);
  };

  return {
    isAuthenticated: !!staff,
    isLoading: isLoading || verifyQuery.isLoading,
    staff,
    token,
    login,
    logout,
  };
}
