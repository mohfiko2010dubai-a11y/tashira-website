import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient();
export const trpcClient = trpc.createClient({
  links: [
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
            throw new Error("API returned HTML page instead of JSON. Check server status.");
          }
          const text = await res.clone().text();
          if (text && !text.startsWith("{") && !text.startsWith("[")) {
            throw new Error("The server could not complete the request. Please retry.");
          }
          return res;
        });
      },
    }),
  ],
});
