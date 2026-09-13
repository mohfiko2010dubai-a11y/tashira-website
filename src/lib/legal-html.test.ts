import { describe, expect, it } from "vitest";
import { validatedLegalHtml } from "./legal-html";

describe("repository policy HTML on the server", () => {
  it("preserves allowed policy markup and links", () => {
    const html = '<h2>Policy</h2><p><strong>Contact</strong> <a href="/contact">Support</a> <a href="mailto:help@example.test">Email</a></p>';
    expect(validatedLegalHtml(html)).toBe(html);
  });
  it.each(['<script>alert(1)</script>', '<p onclick="alert(1)">Text</p>', '<a href="javascript:alert(1)">x</a>', '<a href="//evil.test">x</a>', '<img src=x onerror=alert(1)>', '<p incomplete'])('rejects unsafe or malformed markup: %s', html => {
    expect(() => validatedLegalHtml(html)).toThrow();
  });
});
