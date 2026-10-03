import { trpc } from '@/providers/trpc-client';

export function useApplicationIntake() {
  return trpc.intakeStatus.useQuery(undefined, {
    staleTime: 0,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
