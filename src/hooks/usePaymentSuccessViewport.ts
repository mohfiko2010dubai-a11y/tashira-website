interface PaymentSuccessHeading {
  focus(options: { preventScroll: boolean }): void;
}

interface PaymentSuccessWindow {
  scrollTo(options: { top: number; left: number; behavior: "auto" }): void;
}

export function resetPaymentSuccessViewport(
  heading: PaymentSuccessHeading | null,
  browserWindow: PaymentSuccessWindow,
): void {
  browserWindow.scrollTo({ top: 0, left: 0, behavior: "auto" });
  heading?.focus({ preventScroll: true });
}
