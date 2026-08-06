// Local file storage — no external dependencies
// Files stored outside dist/ so they survive rebuilds

import fs from "fs";
import path from "path";
import crypto from "crypto";

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
  resolveStoragePath(filePath);
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_EXPIRY;
  const signature = signStorageUrl(filePath, expires);
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  return { signedUrl: `/storage/${encodedPath}?expires=${expires}&signature=${signature}` };
}

function signStorageUrl(filePath: string, expires: number): string {
  const secret = process.env.STORAGE_URL_SECRET || "";
  if (secret.length < 32) throw new Error("STORAGE_URL_SECRET must be at least 32 characters");
  return crypto.createHmac("sha256", secret).update(`${filePath}\n${expires}`).digest("base64url");
}

export function verifyStorageSignedUrl(filePath: string, expiresValue: string, signature: string): boolean {
  if (!/^\d+$/.test(expiresValue) || !signature) return false;
  const expires = Number(expiresValue);
  if (expires <= Math.floor(Date.now() / 1000)) return false;

  let expected: string;
  try {
    resolveStoragePath(filePath);
    expected = signStorageUrl(filePath, expires);
  } catch {
    return false;
  }

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * Check if local storage is configured
 */
export function isStorageConfigured(): boolean {
  return true; // Always configured
}

export const STORAGE_BUCKET = "local";
export const SIGNED_URL_EXPIRY = 15 * 60;
