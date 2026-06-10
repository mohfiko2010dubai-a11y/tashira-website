import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    // Log all tRPC requests for debugging
    loggerLink({
      enabled: () => true,
      console: {
        log: (...args) => console.log("[tRPC]", ...args),
        error: (...args) => console.error("[tRPC]", ...args),
      },
    }),
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        }).then(async (res) => {
          const contentType = res.headers.get("content-type") || "";

          // If response is HTML, the API route is broken
          if (contentType.includes("text/html")) {
            const text = await res.clone().text();
            console.error("[tRPC] API returned HTML instead of JSON:", text.slice(0, 300));
            throw new Error("API returned HTML page instead of JSON. Check server status.");
          }

          // Defensive: read as text first
          const text = await res.clone().text();
          if (text && !text.startsWith("{") && !text.startsWith("[")) {
            console.error("[tRPC] API raw response:", text.slice(0, 300));
            throw new Error("API returned non-JSON: " + text.slice(0, 200));
          }

          return res;
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
