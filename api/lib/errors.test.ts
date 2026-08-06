import { describe, expect, it } from "vitest";

import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("returns the message from an Error", () => {
    expect(getErrorMessage(new Error("request failed"))).toBe("request failed");
  });

  it("uses the default fallback for non-Error values", () => {
    expect(getErrorMessage("request failed")).toBe("Unknown error");
  });

  it("uses a caller-provided fallback", () => {
    expect(getErrorMessage(null, "Unable to continue")).toBe("Unable to continue");
  });
});
