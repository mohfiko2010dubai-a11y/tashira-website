// Only allowlisted operational metadata may cross the logging boundary.
// Free text cannot be reliably scrubbed for names or passport numbers.
const events = new Set([
  "security_audit", "request_error", "ssr_fallback", "ssr_render", "ssr_redirect_lookup",
  "admin.login", "staging-owner.login", "admin.password_change", "admin.logout", "staff.login", "staff.logout",
  "application.status_change", "document.upload", "document.delete", "payment.intent_create",
  "payment.readiness_rejected", "payment.confirm", "customer.recovery_requested", "customer.recovery_verified",
  "email.notification", "content.create", "content.edit", "content.review", "content.publish",
  "content.unpublish", "content.archive", "content.redirect",
]);
const enumValues = new Set(["success", "failure", "anonymous", "admin", "staff", "customer", "system",
  "render_timeout", "data_timeout", "render_error", "en", "ar", "rendered", "fallback",
  "Error", "TypeError", "RangeError", "TRPCError", "ZodError", "ER_DUP_ENTRY", "ER_LOCK_DEADLOCK",
  "ER_LOCK_WAIT_TIMEOUT", "ECONNREFUSED", "ETIMEDOUT", "INTERNAL_SERVER_ERROR", "BAD_REQUEST",
  "FORBIDDEN", "UNAUTHORIZED", "NOT_FOUND", "CONFLICT", "PRECONDITION_FAILED", "TOO_MANY_REQUESTS"]);
const enumKeys = new Set(["outcome", "actor", "reason", "language", "mode", "category", "code"]);
const metricKeys = new Set(["elapsedMs", "dataWallMs", "reactMs", "serializationMs", "otherMs", "catalogMs", "cmsMs", "cmsGuidesMs", "cmsNewsMs", "articleMs", "workerStartupMs", "status"]);
const routes = new Set(["/", "/visa-prices", "/how-to-apply", "/guides", "/news", "/about", "/editorial-policy",
  "/apply", "/track", "/terms", "/privacy", "/refund", "/cookies", "/contact", "/visa-pre-check", "/documents", "/:section/:slug"]);

export function sanitizeLog(value: unknown): Record<string, string | number> {
  if (typeof value === "string") {
    try { return sanitizeLog(JSON.parse(value)); } catch { return { event: "redacted_log" }; }
  }
  if (value instanceof Error) return { event: "redacted_error", category: enumValues.has(value.name) ? value.name : "Error" };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { event: "redacted_log" };
  const result: Record<string, string | number> = {};
  for (const [key, item] of Object.entries(value)) {
    if ((key === "event" || key === "type") && typeof item === "string" && events.has(item)) result[key] = item;
    else if (enumKeys.has(key) && typeof item === "string" && enumValues.has(item)) result[key] = item;
    else if (metricKeys.has(key) && typeof item === "number" && Number.isFinite(item)) result[key] = item;
    else if (key === "route" && typeof item === "string" && routes.has(item)) result[key] = item;
    else if (key === "correlationId" && typeof item === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item)) result[key] = item;
    else if (key === "timestamp" && typeof item === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item)) result[key] = item;
  }
  return Object.keys(result).length ? result : { event: "redacted_log" };
}

export function installSafeConsole(target: Pick<Console, "log" | "info" | "warn" | "error" | "debug" | "trace" | "dir" | "table">): void {
  const sinks = { log: target.log.bind(target), info: target.info.bind(target), warn: target.warn.bind(target),
    error: target.error.bind(target), debug: target.debug.bind(target) };
  for (const method of ["log", "info", "warn", "error", "debug", "trace", "dir", "table"] as const) {
    // Never call native trace/dir: they can append uncontrolled stacks/options.
    const sink = method === "trace" || method === "dir" || method === "table" ? sinks.log : sinks[method];
    target[method] = (...values: unknown[]) => sink(JSON.stringify({ level: method, entries: values.map(sanitizeLog) }));
  }
}
