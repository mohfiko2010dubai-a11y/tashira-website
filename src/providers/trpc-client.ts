import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient();
export const trpcClient = trpc.createClient({
  links: [
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
      headers() {
        const staffToken = globalThis.localStorage?.getItem("tashira_staff_auth");
        return staffToken ? { "x-staff-token": staffToken } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        }).then(async (res) => {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("text/html")) {
            const text = await res.clone().text();
            console.error("[tRPC] API returned HTML instead of JSON:", text.slice(0, 300));
            throw new Error("API returned HTML page instead of JSON. Check server status.");
          }
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
