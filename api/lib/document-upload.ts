import { DOCUMENT_MIME_TYPES, DOCUMENT_SIZE_GUIDANCE, MAX_DOCUMENT_FILE_SIZE, UNSUPPORTED_DOCUMENT_GUIDANCE } from "../../contracts/document-upload-policy";
export { MAX_DOCUMENT_FILE_SIZE } from "../../contracts/document-upload-policy";

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
  if (!DOCUMENT_MIME_TYPES.has(mimeType)) {
    return UNSUPPORTED_DOCUMENT_GUIDANCE;
  }
  if (declaredSize <= 0 || declaredSize > MAX_DOCUMENT_FILE_SIZE) {
    return DOCUMENT_SIZE_GUIDANCE;
  }
  if (decodedSize !== undefined && decodedSize !== declaredSize) {
    return "Uploaded file size does not match the declared size";
  }
  return null;
}
