// Local file storage — no external dependencies
// Files stored outside dist/ so they survive rebuilds

import fs from "fs";
import path from "path";

const DEFAULT_STORAGE_ROOT = "/var/www/tashira/storage/documents";

export function getStorageRoot(): string {
  return path.resolve(process.env.STORAGE_ROOT || DEFAULT_STORAGE_ROOT);
}

export function resolveStoragePath(filePath: string): string {
  const storageRoot = getStorageRoot();
  const fullPath = path.resolve(storageRoot, filePath);
  const relativePath = path.relative(storageRoot, fullPath);

  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Invalid storage path");
  }

  return fullPath;
}

/**
 * Upload a file to local storage
 */
export async function storageUpload(
  filePath: string,
  fileBuffer: Buffer,
  _mimeType: string,
): Promise<{ path: string }> {
  void _mimeType;
  const fullPath = resolveStoragePath(filePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, fileBuffer);

  return { path: filePath };
}

/**
 * Delete a file from local storage
 */
export async function storageDelete(filePath: string): Promise<void> {
  const fullPath = resolveStoragePath(filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

/**
 * Create a local URL for a file (no expiry — direct access)
 */
export async function storageCreateSignedUrl(filePath: string): Promise<{ signedUrl: string }> {
  return { signedUrl: `/storage/${filePath}` };
}

/**
 * Check if local storage is configured
 */
export function isStorageConfigured(): boolean {
  return true; // Always configured
}

export const STORAGE_BUCKET = "local";
export const SIGNED_URL_EXPIRY = 86400; // 24 hours
