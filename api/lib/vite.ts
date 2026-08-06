import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(process.cwd(), "dist/public");

  // Serve static files for non-API, non-storage routes only
  app.use("*", async (c, next) => {
    const requestPath = c.req.path;
    // Never serve static files for API or storage routes
    if (requestPath.startsWith("/api/") || requestPath.startsWith("/storage/") || requestPath.startsWith("/invoices/")) {
      return await next();
    }
    return serveStatic({ root: distPath })(c, next);
  });

  app.notFound((c) => {
    const requestPath = c.req.path;
    // API routes always return JSON, never HTML
    if (requestPath.startsWith("/api/")) {
      return c.json({ error: "Not Found", path: requestPath }, 404);
    }
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  });
}
