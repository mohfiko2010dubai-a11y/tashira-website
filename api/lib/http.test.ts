import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpClient } from "./http";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpClient", () => {
  it("serializes query parameters and merges request headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpClient("https://example.test", {
      headers: { "X-Client": "tashira" },
    });
    const result = await client.get<{ ok: boolean }>(
      "/status",
      { page: 2, search: "visa" },
      { headers: { "X-Request": "review" } },
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/status?page=2&search=visa");
    expect(init).toMatchObject({
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Client": "tashira",
        "X-Request": "review",
      },
    });
  });

  it("serializes POST bodies as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 42 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpClient("https://example.test");
    await client.post("/applications", { country: "UAE" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/applications",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ country: "UAE" }),
      }),
    );
  });

  it("uses a JSON API error message for unsuccessful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Access denied" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const client = new HttpClient("https://example.test");

    await expect(client.get("/private")).rejects.toThrow("Access denied");
  });

  it("falls back to the HTTP status for non-JSON error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })),
    );

    const client = new HttpClient("https://example.test");

    await expect(client.get("/health")).rejects.toThrow("HTTP Error: 503");
  });
});
