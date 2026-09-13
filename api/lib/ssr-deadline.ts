export const SSR_RENDER_TIMEOUT_MS = 3_000;
export const SSR_DATA_TIMEOUT_MS = 1_000;

export class SsrDeadlineError extends Error {
  readonly stage: "render" | "data";

  constructor(stage: "render" | "data") {
    super(`SSR ${stage} deadline exceeded`);
    this.name = "SsrDeadlineError";
    this.stage = stage;
  }
}

/** The operation must forward this signal to fetch/stream/worker cancellation. */
export function withSsrDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: { stage: "render" | "data"; parent?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? (options.stage === "render" ? SSR_RENDER_TIMEOUT_MS : SSR_DATA_TIMEOUT_MS);
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.parent?.removeEventListener("abort", onParentAbort);
      callback();
    };
    const cancel = (reason: unknown) => finish(() => {
      // Reject first so a cancelled operation cannot replace the deadline reason.
      reject(reason);
      controller.abort(reason);
    });
    const onParentAbort = () => cancel(options.parent?.reason ?? new Error("SSR request aborted"));
    const timer = setTimeout(() => cancel(new SsrDeadlineError(options.stage)), timeoutMs);
    if (options.parent?.aborted) {
      onParentAbort();
      return;
    }
    options.parent?.addEventListener("abort", onParentAbort, { once: true });
    Promise.resolve().then(() => operation(controller.signal)).then(
      value => finish(() => resolve(value)),
      error => finish(() => reject(error)),
    );
  });
}
