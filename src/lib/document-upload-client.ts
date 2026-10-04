import { createTRPCClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { DocumentUploadProgress } from "../../contracts/document-upload-policy";

// A dedicated, unbatched transport exposes actual upload bytes. Reaching 100%
// means transmission finished, not that conversion or document saving finished.
export function documentUploadClient(onProgress: (progress: DocumentUploadProgress) => void) {
  return createTRPCClient<AppRouter>({ links: [httpLink({
    url: "/api/trpc", transformer: superjson,
    headers() {
      return { 'x-staff-active': '1' }; // Upload is an explicit user action; authentication uses HttpOnly cookies.
    },
    fetch(input, init) {
      return new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(init?.method ?? "POST", String(input));
        xhr.withCredentials = true;
        xhr.timeout = 120_000;
        new Headers(init?.headers).forEach((value, key) => xhr.setRequestHeader(key, value));
        const fail = () => reject(new Error("The upload did not finish. Check your connection and retry."));
        xhr.onerror = fail; xhr.ontimeout = fail; xhr.onabort = fail;
        xhr.upload.onprogress = event => onProgress({ phase: "uploading", percent: event.lengthComputable ? Math.round(event.loaded * 100 / event.total) : undefined });
        xhr.upload.onload = () => onProgress({ phase: "processing" });
        xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status, headers: { "content-type": xhr.getResponseHeader("content-type") ?? "application/json" } }));
        if (init?.signal?.aborted) { fail(); return; }
        const abort = () => xhr.abort();
        init?.signal?.addEventListener("abort", abort, { once: true });
        xhr.onloadend = () => init?.signal?.removeEventListener("abort", abort);
        onProgress({ phase: "uploading", percent: 0 });
        xhr.send(typeof init?.body === "string" ? init.body : null);
      });
    },
  })] });
}
