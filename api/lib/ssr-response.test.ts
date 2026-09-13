import { afterEach, describe, expect, it, vi } from "vitest";
import { SSR_DATA_TIMEOUT_MS, SSR_RENDER_TIMEOUT_MS, SsrDeadlineError, withSsrDeadline } from "./ssr-deadline";
import { renderSsrResponse, SsrPageNotFound } from "./ssr-response";

const shell = '<html lang="en" dir="ltr"><head><title>Fixture title</title><meta name="description" content="Fixture description"><link rel="canonical" href="https://www.example.test/visa-prices"></head><body><div id="root"></div><script type="module" src="/assets/client-test.js"></script></body></html>';
afterEach(() => vi.useRealTimers());

describe("SSR failure containment", () => {
  it("keeps a confirmed missing CMS page a real 404", async () => {
    const logFailure = vi.fn();
    const response = await renderSsrResponse({ routeTemplate: "/guides/:slug", shellHtml: shell, noindex: false, render: async () => { throw new SsrPageNotFound(); }, logFailure });
    expect(response.status).toBe(404);
    expect(response.headers.get("X-Tashira-SSR")).toBeNull();
    expect(await response.text()).toContain("Page not found");
    expect(logFailure).not.toHaveBeenCalled();
  });
  it("returns uncached SSR HTML without logging a failure", async () => {
    const logFailure = vi.fn();
    const response = await renderSsrResponse({ routeTemplate: "/visa-prices", shellHtml: shell, noindex: false, render: async () => "<main>Prices</main>", logFailure });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toContain("Prices");
    expect(logFailure).not.toHaveBeenCalled();
  });

  it("preserves shell metadata, scripts and noindex after a render error without logging sensitive details", async () => {
    const logFailure = vi.fn();
    const response = await renderSsrResponse({ routeTemplate: "/apply/:referenceNumber/interview", shellHtml: shell, noindex: true, render: async () => { throw new Error("secret customer data"); }, logFailure });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe(shell);
    expect(logFailure).toHaveBeenCalledWith(expect.objectContaining({ route: "/apply/:referenceNumber/interview", reason: "render_error" }));
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain("secret");
  });

  it("aborts a stalled render at three seconds and returns a 200 fallback", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const logFailure = vi.fn();
    const pending = renderSsrResponse({ routeTemplate: "/", shellHtml: shell, noindex: false, logFailure, render: async value => { signal = value; return new Promise<string>(() => undefined); } });
    await vi.advanceTimersByTimeAsync(SSR_RENDER_TIMEOUT_MS);
    const response = await pending;
    expect(signal?.aborted).toBe(true);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(shell);
    expect(logFailure).toHaveBeenCalledWith(expect.objectContaining({ reason: "render_timeout" }));
  });

  it("aborts a stalled data call at one second and reports data timeout", async () => {
    vi.useFakeTimers();
    const logFailure = vi.fn();
    let signal: AbortSignal | undefined;
    const pending = renderSsrResponse({ routeTemplate: "/news", shellHtml: shell, noindex: false, logFailure, render: parent => withSsrDeadline(async value => { signal = value; return new Promise<string>(() => undefined); }, { stage: "data", parent }) });
    await vi.advanceTimersByTimeAsync(SSR_DATA_TIMEOUT_MS);
    expect(await (await pending).text()).toBe(shell);
    expect(signal?.aborted).toBe(true);
    expect(logFailure).toHaveBeenCalledWith(expect.objectContaining({ reason: "data_timeout" }));
  });

  it("does not start data work for an already-aborted request", async () => {
    const parent = new AbortController();
    const reason = new SsrDeadlineError("render");
    parent.abort(reason);
    const operation = vi.fn();
    await expect(withSsrDeadline(operation, { stage: "data", parent: parent.signal })).rejects.toBe(reason);
    expect(operation).not.toHaveBeenCalled();
  });

  it("falls back on empty output rather than sending a blank success page", async () => {
    const response = await renderSsrResponse({ routeTemplate: "/", shellHtml: shell, noindex: false, render: async () => " ", logFailure: vi.fn() });
    expect(await response.text()).toBe(shell);
  });
});
