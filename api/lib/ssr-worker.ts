import { Worker } from "node:worker_threads";
import path from "node:path";
import type { PageMetadata } from "../../contracts/ssr-pages";
import { SsrDeadlineError } from "./ssr-deadline";

export type RenderResult = { html: string; meta: PageMetadata | null; state: unknown; notFound?: false } | { notFound: true };
let activeWorkers = 0;

/** Workers isolate synchronous React work so the caller's deadline remains enforceable. */
export function renderInWorker(job: { url: string; apiOrigin: string; fault?: string }, signal: AbortSignal): Promise<RenderResult> {
  if (activeWorkers >= 2) return Promise.reject(new Error("SSR capacity unavailable"));
  if (signal.aborted) return Promise.reject(signal.reason);
  activeWorkers++;
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(path.resolve("dist/server/entry-server.js"), { workerData: job }); }
    catch (error) { activeWorkers--; reject(error); return; }
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      activeWorkers--;
      signal.removeEventListener("abort", cancel);
      void worker.terminate();
      callback();
    };
    const cancel = () => finish(() => reject(signal.reason));
    signal.addEventListener("abort", cancel, { once: true });
    worker.once("message", (message: { ok: boolean; result: RenderResult; reason?: string }) => finish(() => {
      if (message.ok) resolve(message.result);
      else reject(message.reason === "data_timeout" ? new SsrDeadlineError("data") : new Error("SSR worker render failed"));
    }));
    worker.once("error", error => finish(() => reject(error)));
    worker.once("exit", () => finish(() => reject(new Error("SSR worker exited without HTML"))));
  });
}
