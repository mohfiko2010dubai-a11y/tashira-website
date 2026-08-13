import { describe, expect, it, vi } from "vitest";

import { resetPaymentSuccessViewport } from "../../src/hooks/usePaymentSuccessViewport";

describe("payment success viewport", () => {
  it("resets retained checkout scroll and focuses the success heading", () => {
    const scrollTo = vi.fn();
    const focus = vi.fn();

    resetPaymentSuccessViewport({ focus }, { scrollTo });

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("still resets scroll when the heading is not mounted", () => {
    const scrollTo = vi.fn();

    resetPaymentSuccessViewport(null, { scrollTo });

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });
});
