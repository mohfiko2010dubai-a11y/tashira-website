import crypto from "crypto";
import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("staff password hashing", () => {
  it("uses a unique salted scrypt hash", async () => {
    const first = await hashPassword("review-password");
    const second = await hashPassword("review-password");
    expect(first).toMatch(/^scrypt\$/);
    expect(first).not.toBe(second);
    await expect(verifyPassword("review-password", first)).resolves.toEqual({ valid: true, needsUpgrade: false });
    await expect(verifyPassword("wrong", first)).resolves.toEqual({ valid: false, needsUpgrade: false });
  });

  it("accepts a valid legacy hash once and requests an upgrade", async () => {
    const legacy = crypto.createHash("sha256")
      .update("review-password" + "tashira-staff-salt-2025")
      .digest("hex");
    await expect(verifyPassword("review-password", legacy)).resolves.toEqual({ valid: true, needsUpgrade: true });
  });
});
