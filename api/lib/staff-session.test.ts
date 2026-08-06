import { afterEach, describe, expect, it, vi } from "vitest";

import { createStaffSession, deleteStaffSession, getStaffSession } from "./staff-session";

afterEach(() => vi.useRealTimers());

describe("staff sessions", () => {
  it("creates and deletes opaque server-side sessions", () => {
    const token = createStaffSession(42);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(getStaffSession(token)).toEqual({ staffId: 42 });
    deleteStaffSession(token);
    expect(getStaffSession(token)).toBeNull();
  });

  it("expires sessions after eight hours", () => {
    vi.useFakeTimers();
    const token = createStaffSession(42);
    vi.advanceTimersByTime(8 * 60 * 60 * 1000 + 1);
    expect(getStaffSession(token)).toBeNull();
  });
});
