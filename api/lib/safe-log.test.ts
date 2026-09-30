import { describe, expect, it, vi } from "vitest";
import { installSafeConsole, sanitizeLog } from "../../contracts/safe-log";
import { publicError } from "./public-error";
import { TRPCError } from "@trpc/server";

describe("central privacy boundary", () => {
  it("drops free text, nested objects, filenames and SQL regardless of field names", () => {
    const secret = "Mohammed Zaky next4-log-probe@example.invalid +971501234567 P1234567 passport.pdf";
    for (const value of [secret, new Error(secret), { message: secret }, { nested: { email: secret } },
      { event: secret, code: secret, route: `/apply/${secret}`, timestamp: secret }, JSON.stringify({ email: secret })]) {
      expect(JSON.stringify(sanitizeLog(value))).not.toContain(secret);
      expect(JSON.stringify(sanitizeLog(value))).not.toContain("passport.pdf");
    }
  });
  it("protects every console method without depending on call-site redaction", () => {
    const sink = vi.fn();
    const target = { log: sink, info: sink, warn: sink, error: sink, debug: sink, trace: sink, dir: sink, table: sink };
    installSafeConsole(target);
    for (const method of Object.keys(target) as Array<keyof typeof target>) target[method]("passport.pdf", { name: "Private Name" });
    expect(sink).toHaveBeenCalledTimes(8);
    expect(JSON.stringify(sink.mock.calls)).not.toMatch(/passport.pdf|Private Name/);
  });
  it("preserves SSR failure observability and audit metadata", () => {
    expect(sanitizeLog({ event: "ssr_fallback", route: "/visa-prices", reason: "data_timeout", elapsedMs: 800 }))
      .toEqual({ event: "ssr_fallback", route: "/visa-prices", reason: "data_timeout", elapsedMs: 800 });
    expect(sanitizeLog(JSON.stringify({ type: "security_audit", event: "staff.login", actor: "staff", outcome: "success" })))
      .toEqual({ type: "security_audit", event: "staff.login", actor: "staff", outcome: "success" });
  });
  it("retains timestamped per-layer SSR numbers through the actual console wrapper without request data", () => {
    const sink = vi.fn();const target = { log: sink, info: sink, warn: sink, error: sink, debug: sink, trace: sink, dir: sink, table: sink };
    installSafeConsole(target);
    target.info(JSON.stringify({ event: "ssr_render", route: "/documents", timestamp: "2026-09-30T08:00:00.000Z", workerStartupMs: 300, catalogMs: 25, cmsGuidesMs: 30, cmsNewsMs: 29, articleMs: 14, query: "passport=private" }));
    const output = JSON.parse(sink.mock.calls[0][0]);
    expect(output.entries[0]).toEqual({ event: "ssr_render", route: "/documents", timestamp: "2026-09-30T08:00:00.000Z", workerStartupMs: 300, catalogMs: 25, cmsGuidesMs: 30, cmsNewsMs: 29, articleMs: 14 });
    expect(JSON.stringify(output)).not.toContain("passport");
  });
  it("never exposes an internal query exception and gives a traceable correlation id", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: new Error("Failed query INSERT INTO applicants params: private@example.invalid") });
      const result = publicError(error);
      expect(result.message).not.toMatch(/INSERT|params|private@example/);
      expect(result.message).toContain(result.correlationId);
      expect(JSON.stringify(log.mock.calls)).toContain(result.correlationId);
      expect(JSON.stringify(log.mock.calls)).not.toContain("private@example");
    } finally { log.mockRestore(); }
  });
  it("retains explicit business guidance without a cause", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try { expect(publicError(new TRPCError({ code: "BAD_REQUEST", message: "Choose nationality and country of residence to see your documents." })).message)
      .toBe("Choose nationality and country of residence to see your documents."); } finally { log.mockRestore(); }
  });
});
