import { trpc } from '@/providers/trpc-client';

export function useAdminAuth() {
  const utils = trpc.useUtils();
  const adminState = trpc.auth.adminMe.useQuery(undefined, { retry: false });
  const loginMutation = trpc.auth.adminLogin.useMutation();
  const logoutMutation = trpc.auth.adminLogout.useMutation();

  const login = async (password: string): Promise<boolean> => {
    try {
      await loginMutation.mutateAsync({ password });
      await utils.auth.adminMe.invalidate();
      const result = await adminState.refetch();
      return result.data?.authenticated === true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    utils.auth.adminMe.setData(undefined, { authenticated: false });
    window.location.href = '/admin/login';
  };

  return {
    isAuthenticated: adminState.data?.authenticated === true,
    isLoading: adminState.isLoading,
    login,
    logout,
  };
}
