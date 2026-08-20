const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function publicAppOrigin(configuredUrl = process.env.PUBLIC_APP_URL) {
  if (!configuredUrl) throw new Error("PUBLIC_APP_URL is required");

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("PUBLIC_APP_URL must be a valid absolute URL");
  }

  if (
    url.protocol !== "https:" ||
    loopbackHostnames.has(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("PUBLIC_APP_URL must be a secure application origin");
  }

  return url.origin;
}

export function requirePublicAppUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Application URL is invalid");
  }
  if (url.protocol !== "https:" || url.origin !== publicAppOrigin() || url.username || url.password) {
    throw new Error("Application URL origin is not approved");
  }
  return url;
}
