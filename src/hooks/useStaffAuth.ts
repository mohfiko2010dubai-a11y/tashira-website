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
  const [sessionStaff, setSessionStaff] = useState<StaffUser | null>(null);
  const logoutMutation = trpc.staff.logout.useMutation();

  const verifyQuery = trpc.staff.verify.useQuery(
    undefined,
    { retry: false, refetchInterval: 60_000 }
  );

  // Retire the former script-readable token. Authentication uses the HttpOnly cookie.
  useEffect(() => {
    localStorage.removeItem(STAFF_AUTH_KEY);
  }, []);

  const staff = sessionStaff ?? verifyQuery.data ?? null;

  const login = (staffData: StaffUser) => {
    setSessionStaff(staffData);
  };

  const logout = async () => {
    localStorage.removeItem(STAFF_AUTH_KEY);
    setSessionStaff(null);
    try {
      await logoutMutation.mutateAsync();
    } finally {
      window.location.href = '/staff/login';
    }
  };

  const isLoading = verifyQuery.isLoading && !sessionStaff;

  return {
    isAuthenticated: !!staff,
    isLoading,
    staff,
    login,
    logout,
  };
}
