import { describe, expect, it, vi } from "vitest";
import { ResendEmailProvider, recipientHash } from "./resend-email";

const config = { apiKey: "re_review_only", fromName: "TASHIRA Staging", fromEmail: "onboarding@resend.dev", allowedRecipients: new Set(["owner@example.test"]), staging: true };

describe("Resend staging provider", () => {
  it("sends a staging-labelled provider-independent template", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email_test" }), { status: 200 }));
    const result = await new ResendEmailProvider(config, request).send({ recipient: "owner@example.test", template: "PAYMENT_SUCCESS", variables: { referenceNumber: "TSH-1", invoiceNumber: "INV-1" } });
    expect(result.reference).toBe("email_test");
    expect(JSON.parse(String(request.mock.calls[0][1]?.body)).subject).toContain("[STAGING]");
  });

  it("sends recovery links as clickable HTML with a plain-text fallback", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email_recovery" }), { status: 200 }));
    await new ResendEmailProvider(config, request).send({
      recipient: "owner@example.test",
      template: "RESUME_LINK",
      variables: { referenceNumber: "TSH-1", resumeUrl: "https://staging.tashiraev.com/recover?token=safe-token" },
    });
    const payload = JSON.parse(String(request.mock.calls[0][1]?.body)) as { html: string; text: string };
    expect(payload.html).toContain('href="https://staging.tashiraev.com/recover?token=safe-token"');
    expect(payload.html).toContain("Resume Application");
    expect(payload.text).toContain("https://staging.tashiraev.com/recover?token=safe-token");
  });

  it("rejects recovery links outside the approved staging origin", async () => {
    await expect(new ResendEmailProvider(config).send({
      recipient: "owner@example.test",
      template: "RESUME_LINK",
      variables: { referenceNumber: "TSH-1", resumeUrl: "https://example.test/recover?token=unsafe" },
    })).rejects.toThrow("not an approved staging URL");
  });

  it("fails closed for missing keys and unapproved recipients", async () => {
    expect(() => new ResendEmailProvider({ ...config, apiKey: "" })).toThrow("not configured");
    await expect(new ResendEmailProvider(config).send({ recipient: "customer@example.com", template: "SUBMITTED", variables: { referenceNumber: "TSH-1" } })).rejects.toThrow("not approved");
  });

  it("hashes recipients before durable evidence", () => expect(recipientHash("Owner@Example.Test")).toMatch(/^[a-f0-9]{64}$/));
});
