// Direct REST calls to Supabase Storage API — no @supabase/supabase-js import
// Avoids RealtimeClient initialization crash on Node.js 20

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "tashira-documents";
export const SIGNED_URL_EXPIRY = 600; // 10 minutes in seconds

const STORAGE_API = `${SUPABASE_URL}/storage/v1`;

function authHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

/**
 * Upload a file to Supabase Storage via REST API
 */
export async function storageUpload(
  path: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<{ path: string }> {
  const url = `${STORAGE_API}/object/${STORAGE_BUCKET}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(mimeType),
    body: fileBuffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { path: data.Key || path };
}

/**
 * Delete a file from Supabase Storage via REST API
 */
export async function storageDelete(path: string): Promise<void> {
  const url = `${STORAGE_API}/object/${STORAGE_BUCKET}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders("application/json"),
    body: JSON.stringify([path]),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage delete failed (${res.status}): ${text}`);
  }
}

/**
 * Create a signed URL for a file via REST API
 */
export async function storageCreateSignedUrl(
  filePath: string,
  expiresIn: number = SIGNED_URL_EXPIRY,
): Promise<{ signedUrl: string }> {
  const url = `${STORAGE_API}/object/sign/${STORAGE_BUCKET}/${filePath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders("application/json"),
    body: JSON.stringify({ expiresIn }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage signed URL failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  // signedURL is a relative path like "/object/sign/bucket/path?token=..."
  const signedPath = data.signedURL || data.signedUrl;
  if (!signedPath) {
    throw new Error("No signed URL returned from Supabase");
  }

  // Prepend base URL if relative
  const signedUrl = signedPath.startsWith("http")
    ? signedPath
    : `${SUPABASE_URL}${signedPath}`;

  return { signedUrl };
}

/**
 * Check if Supabase Storage is configured
 */
export function isStorageConfigured(): boolean {
  return !!SUPABASE_URL && !!SERVICE_KEY;
}
