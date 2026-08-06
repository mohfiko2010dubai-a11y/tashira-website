import { afterEach, describe, expect, it, vi } from "vitest";

import { auditLog } from "./audit-log";

afterEach(() => vi.restoreAllMocks());

describe("security audit logging", () => {
  it("emits a structured allowlisted event without identifiers or PII", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    auditLog("document.upload", "success", "customer");

    expect(info).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(info.mock.calls[0][0])) as Record<string, unknown>;
    expect(payload).toMatchObject({
      type: "security_audit",
      event: "document.upload",
      outcome: "success",
      actor: "customer",
    });
    expect(Object.keys(payload).sort()).toEqual(["actor", "event", "outcome", "timestamp", "type"]);
  });
});
