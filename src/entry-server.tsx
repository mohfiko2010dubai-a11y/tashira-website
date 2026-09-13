import { parentPort, workerData } from "node:worker_threads";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { I18nextProvider } from "react-i18next";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import PublicApp from "./PublicApp";
import { createAppI18n } from "./i18n";
import { TRPCProvider } from "./providers/trpc";
import { trpc } from "./providers/trpc-client";
import { articleMetadata, fixedMetadata, type PageMetadata } from "@contracts/ssr-pages";
import { withSsrDeadline } from "../api/lib/ssr-deadline";

type Job = { url: string; apiOrigin: string; fault?: string };
async function render(job: Job) {
  const url = new URL(job.url, "https://www.tashiraev.com");
  const path = url.pathname;
  if (job.fault === "render-error") throw new Error("Deliberate staging render error");
  // Block this worker deliberately, proving the parent can enforce a hard deadline.
  if (job.fault === "render-timeout") Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  const client = trpc.createClient({ links: [httpBatchLink({
    url: `${job.apiOrigin}/api/trpc`, transformer: superjson,
    fetch: (input, init) => withSsrDeadline(async signal => {
      if (job.fault === "data-timeout") await new Promise(() => undefined);
      const response = await fetch(input, { ...init, signal });
      return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
    }, { stage: "data" }),
  })] });
  let meta: PageMetadata | null = fixedMetadata(path);
  try {
    const work: Promise<unknown>[] = [];
    if (path === "/" || path === "/visa-prices") work.push(queries.fetchQuery({
      queryKey: getQueryKey(trpc.catalog.listActiveProducts, undefined, "query"),
      queryFn: () => client.catalog.listActiveProducts.query(),
    }));
    for (const type of ["GUIDE", "NEWS"] as const) {
      if (path === "/" || path === (type === "GUIDE" ? "/guides" : "/news")) {
        const input = { contentType: type, language: "en" as const };
        work.push(queries.fetchQuery({ queryKey: getQueryKey(trpc.content.publicList, input, "query"), queryFn: () => client.content.publicList.query(input) }));
      }
    }
    if (/^\/(guides|news|uae-visa)\/[^/]+$/.test(path)) {
      const input = { slug: path.slice(1), language: "en" as const };
      const article = await queries.fetchQuery({ queryKey: getQueryKey(trpc.content.publicBySlug, input, "query"), queryFn: () => client.content.publicBySlug.query(input) });
      meta = path.startsWith("/uae-visa/")
        ? { title: article.seoTitle || article.title, description: article.metaDescription || "", canonicalPath: path, image: article.ogImage }
        : articleMetadata(article, path);
      const related = { contentType: "GUIDE" as const, language: "en" as const };
      work.push(queries.fetchQuery({ queryKey: getQueryKey(trpc.content.publicList, related, "query"), queryFn: () => client.content.publicList.query(related) }));
    }
    await Promise.all(work);
    const i18n = createAppI18n("en");
    const html = await new Promise<string>((resolve, reject) => {
      const output = new PassThrough();
      const chunks: Buffer[] = [];
      output.on("data", chunk => chunks.push(Buffer.from(chunk)));
      output.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      output.on("error", reject);
      const stream = renderToPipeableStream(
        <I18nextProvider i18n={i18n}><TRPCProvider client={client} queries={queries}><StaticRouter location={job.url}><PublicApp /></StaticRouter></TRPCProvider></I18nextProvider>,
        { onAllReady() { stream.pipe(output); }, onError(error) { stream.abort(); reject(error); } },
      );
    });
    return { html, meta, state: superjson.serialize(dehydrate(queries)) };
  } catch (error) {
    if (!meta && error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") return { notFound: true };
    throw error;
  } finally { queries.clear(); }
}

void render(workerData as Job).then(
  result => parentPort?.postMessage({ ok: true, result }),
  error => parentPort?.postMessage({ ok: false, reason: error?.name === "SsrDeadlineError" || String(error?.message).includes("data deadline") ? "data_timeout" : "render_error" }),
);
