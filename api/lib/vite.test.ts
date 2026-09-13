import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { getFrontendCacheControl, serveStaticFiles } from "./vite";
import { fixedMetadata } from "../../contracts/ssr-pages";

const mocks = vi.hoisted(() => ({ render: vi.fn(), admin: vi.fn() }));
vi.mock("./ssr-worker", () => ({ renderInWorker: mocks.render }));
vi.mock("./admin-session", () => ({ verifyAdminSessionAsync: mocks.admin }));
vi.mock("node:fs", () => ({ default: { readFileSync: () => '<html><head><!--PAGE_METADATA--></head><body><div id="root"></div><script src="/assets/client.js"></script></body></html>' } }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("frontend cache policy", () => {
  it("never stores HTML or client-side routes", () => {
    expect(getFrontendCacheControl("/")).toBe("private, no-store");
    expect(getFrontendCacheControl("/admin/applications")).toBe("private, no-store");
  });

  it("caches content-hashed Vite assets immutably", () => {
    expect(getFrontendCacheControl("/assets/AdminApplications-b3w7EEc2.js")).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});

describe("SSR HTTP boundaries", () => {
  function app() { const app = new Hono<{ Bindings: HttpBindings }>(); serveStaticFiles(app); return app; }
  it("redirects the root by Accept-Language without caching that choice", async () => {
    const response = await app().request('/', { headers: { 'Accept-Language': 'ar-AE,en;q=0.8' } });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/ar');
    expect(response.headers.get('Vary')).toBe('Accept-Language');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it.each([{ notFound: true }, { html: '', meta: fixedMetadata('/visa-prices'), state: {} }])("never treats missing catalog data or an empty render as a missing pricing route", async result => {
    mocks.render.mockResolvedValue(result);
    const response = await app().request('/en/visa-prices');
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Tashira-SSR')).toBe('fallback');
    expect(await response.text()).toContain('UAE Visa Fees by Type and Duration | TASHIRA');
  });
  it("returns fixed metadata and public body with no HTML cache", async () => {
    mocks.render.mockResolvedValue({ html: '<h1>Visa fees</h1>', meta: fixedMetadata('/visa-prices'), state: {} });
    const response = await app().request('/en/visa-prices');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.text()).toContain('UAE Visa Fees by Type and Duration | TASHIRA');
  });
  it.each(['/ar/recover?token=synthetic-secret', '/login', '/ar/pay/SYNTHETIC-REF', '/ar/apply/SYNTHETIC-REF/interview', '/ar/track?ref=SYNTHETIC-REF'])("keeps private route %s out of SSR and search metadata", async url => {
    const response = await app().request(url);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
    if (url.startsWith('/ar/recover')) expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(html).not.toMatch(/synthetic-secret|SYNTHETIC-REF/);
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it("returns a real 404 for missing CMS content", async () => {
    mocks.render.mockResolvedValue({ notFound: true });
    const response = await app().request('/en/guides/missing');
    expect(response.status).toBe(404);
  });
  it("accepts fault injection only with staging identity and an admin session", async () => {
    mocks.render.mockResolvedValue({ html: '<h1>Fees</h1>', meta: fixedMetadata('/visa-prices'), state: {} });
    vi.stubEnv('PUBLIC_APP_URL', 'https://staging.tashiraev.com');
    mocks.admin.mockResolvedValue(false);
    await app().request('/en/visa-prices?__ssr_test=render-timeout');
    expect(mocks.render.mock.calls.at(-1)?.[0].fault).toBeUndefined();
    mocks.admin.mockResolvedValue(true);
    await app().request('/en/visa-prices?__ssr_test=render-timeout');
    expect(mocks.render.mock.calls.at(-1)?.[0].fault).toBe('render-timeout');
    vi.stubEnv('PUBLIC_APP_URL', 'https://www.tashiraev.com');
    await app().request('/en/visa-prices?__ssr_test=render-timeout');
    expect(mocks.render.mock.calls.at(-1)?.[0].fault).toBeUndefined();
  });
});
