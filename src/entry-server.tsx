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
import { languagePath, languageRoute } from "@contracts/language-routes";

type Job = { url: string; apiOrigin: string; fault?: string };
async function render(job: Job) {
  const url = new URL(job.url, "https://www.tashiraev.com");
  const route = languageRoute(url.pathname);
  const path = route.pathname;
  const language = route.language;
  const dataCalls: { name: string; elapsedMs: number }[] = [];
  const measure = async <T,>(name: string, call: () => Promise<T>): Promise<T> => {
    const started = performance.now();
    try { return await call(); } finally { dataCalls.push({ name, elapsedMs: performance.now() - started }); }
  };
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
  let meta: PageMetadata | null = fixedMetadata(path, language);
  try {
    const dataStarted = performance.now();
    const work: Promise<unknown>[] = [];
    if (path === "/" || path === "/visa-prices") work.push(queries.fetchQuery({
      queryKey: getQueryKey(trpc.catalog.listActiveProducts, undefined, "query"),
      queryFn: () => measure("catalog.listActiveProducts", () => client.catalog.listActiveProducts.query()),
    }));
    for (const type of ["GUIDE", "NEWS"] as const) {
      if (path === "/" || path === (type === "GUIDE" ? "/guides" : "/news")) {
        const input = { contentType: type, language };
        work.push(queries.fetchQuery({ queryKey: getQueryKey(trpc.content.publicList, input, "query"), queryFn: () => measure(`content.publicList.${type}`, () => client.content.publicList.query(input)) }));
      }
    }
    if (/^\/(guides|news|uae-visa)\/[^/]+$/.test(path)) {
      const input = { slug: path.slice(1), language };
      const article = await queries.fetchQuery({ queryKey: getQueryKey(trpc.content.publicBySlug, input, "query"), queryFn: () => measure("content.publicBySlug", () => client.content.publicBySlug.query(input)) });
      meta = path.startsWith("/uae-visa/")
        ? { title: article.seoTitle || article.title, description: article.metaDescription || "", canonicalPath: languagePath(path, language), image: article.ogImage, language }
        : articleMetadata(article, path, language);
      const related = { contentType: "GUIDE" as const, language };
      work.push(queries.fetchQuery({ queryKey: getQueryKey(trpc.content.publicList, related, "query"), queryFn: () => measure("content.publicList.GUIDE", () => client.content.publicList.query(related)) }));
    }
    await Promise.all(work);
    const dataWallMs = performance.now() - dataStarted;
    const i18n = createAppI18n(language);
    const reactStarted = performance.now();
    const html = await new Promise<string>((resolve, reject) => {
      const output = new PassThrough();
      const chunks: Buffer[] = [];
      output.on("data", chunk => chunks.push(Buffer.from(chunk)));
      output.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      output.on("error", reject);
      const stream = renderToPipeableStream(
        <I18nextProvider i18n={i18n}><TRPCProvider client={client} queries={queries}><StaticRouter basename={route.prefixed ? `/${language}` : "/"} location={job.url}><PublicApp /></StaticRouter></TRPCProvider></I18nextProvider>,
        { onAllReady() { stream.pipe(output); }, onError(error) { stream.abort(); reject(error); } },
      );
    });
    const reactMs = performance.now() - reactStarted;
    const serializeStarted = performance.now();
    const state = superjson.serialize(dehydrate(queries));
    return { html, meta, state, timing: { dataCalls, dataWallMs, reactMs, serializationMs: performance.now() - serializeStarted } };
  } catch (error) {
    if (!meta && error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") return { notFound: true };
    throw error;
  } finally { queries.clear(); }
}

void render(workerData as Job).then(
  result => parentPort?.postMessage({ ok: true, result }),
  error => parentPort?.postMessage({ ok: false, reason: error?.name === "SsrDeadlineError" || String(error?.message).includes("data deadline") ? "data_timeout" : "render_error" }),
);
