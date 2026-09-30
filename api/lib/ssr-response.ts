import { SsrDeadlineError, withSsrDeadline } from "./ssr-deadline";
import { notFoundHtml } from "./ssr-html";

export class SsrPageNotFound extends Error {}

export const SSR_HTML_CACHE_CONTROL = "private, no-store";

export interface SsrFailureEvent {
  event: "ssr_fallback";
  /** A matched route definition, never the request URL or an order reference. */
  route: string;
  reason: "render_timeout" | "data_timeout" | "render_error";
  elapsedMs: number;
}

interface SsrResponseOptions {
  routeTemplate: string;
  language?: "en" | "ar";
  /** Already contains approved static metadata and the working client entry. */
  shellHtml: string;
  render: (signal: AbortSignal) => Promise<string>;
  noindex: boolean;
  logFailure?: (event: SsrFailureEvent) => void;
}

/** Called only after route resolution; genuine missing routes bypass this helper. */
export async function renderSsrResponse(options: SsrResponseOptions): Promise<Response> {
  const started = performance.now();
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": SSR_HTML_CACHE_CONTROL,
  });
  if (options.noindex) headers.set("X-Robots-Tag", "noindex");
  try {
    const html = await withSsrDeadline(options.render, { stage: "render" });
    if (!html.trim()) throw new Error("Empty SSR result");
    headers.set("X-Tashira-SSR", "rendered");
    return new Response(html, { status: 200, headers });
  } catch (error) {
    if (error instanceof SsrPageNotFound) {
      headers.set("X-Robots-Tag", "noindex, nofollow");
      return new Response(notFoundHtml(options.language, options.shellHtml), { status: 404, headers });
    }
    const event: SsrFailureEvent = {
      event: "ssr_fallback",
      route: options.routeTemplate,
      reason: error instanceof SsrDeadlineError ? `${error.stage}_timeout` : "render_error",
      elapsedMs: Math.round(performance.now() - started),
    };
    // Do not log raw exceptions, query strings, cookies or rendered customer data.
    const log = options.logFailure ?? ((entry: SsrFailureEvent) => console.error(JSON.stringify({ ...entry, timestamp: new Date().toISOString() })));
    try { log(event); } catch { console.error("SSR fallback logging failed"); }
    headers.set("X-Tashira-SSR", "fallback");
    return new Response(options.shellHtml, { status: 200, headers });
  }
}
