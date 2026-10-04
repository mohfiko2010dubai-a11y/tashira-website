import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
let lastInteraction = 0;
let activityInstalled = false;
function staffActivityHeader(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  if (!activityInstalled) {
    activityInstalled = true;
    for (const event of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(event, () => { lastInteraction = Date.now(); }, { passive: true });
  }
  return Date.now() - lastInteraction < 60_000 ? { 'x-staff-active': '1' } : {};
}
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        return staffActivityHeader();
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
