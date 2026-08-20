const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

export const MAX_DOCUMENT_FILE_SIZE = 100 * 1024 * 1024;

export function sanitizeDocumentFileName(name: string): string {
  const leafName = name.replace(/\\/g, "/").split("/").pop() || "file";
  const cleanName = leafName.replace(/[^a-zA-Z0-9._\- ]/g, "").slice(0, 200);
  return cleanName || "file";
}

export function validateDocumentFile(
  mimeType: string,
  declaredSize: number,
  decodedSize?: number,
): string | null {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return "File type not allowed. Allowed: PDF, JPG, JPEG, PNG";
  }
  if (declaredSize <= 0 || declaredSize > MAX_DOCUMENT_FILE_SIZE) {
    return "File size must be between 1 byte and 100MB";
  }
  if (decodedSize !== undefined && decodedSize !== declaredSize) {
    return "Uploaded file size does not match the declared size";
  }
  return null;
}
