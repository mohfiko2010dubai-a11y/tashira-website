import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient, trpc, trpcClient } from "./trpc-client";

export function TRPCProvider({ children, client = trpcClient, queries = queryClient }: {
  children: ReactNode; client?: typeof trpcClient; queries?: QueryClient;
}) {
  return <trpc.Provider client={client} queryClient={queries}>
    <QueryClientProvider client={queries}>{children}</QueryClientProvider>
  </trpc.Provider>;
}
