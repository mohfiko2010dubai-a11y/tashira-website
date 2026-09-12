import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { prepareDocumentUpload } from "./prepare-document-upload";
import { storageUpload } from "./local-storage";
import { documentMimeType, MAX_DOCUMENT_FILE_SIZE, PHOTO_CONVERSION_GUIDANCE } from "../../contracts/document-upload-policy";

const input = (bytes: Buffer, fileName: string, mimeType: string) => ({ fileName, mimeType, fileSize: bytes.length, base64Data: bytes.toString("base64") });
afterEach(() => vi.unstubAllEnvs());

describe("server document normalization", () => {
  it("decodes real synthetic HEIC and stores only a readable JPEG with matching metadata", async () => {
    const bytes = await readFile(new URL("./fixtures/synthetic-upload.heic", import.meta.url));
    const result = await prepareDocumentUpload(input(bytes, "test.heic", "image/heic"));
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.fileName).toBe("test.jpg");
    expect(result.fileSize).toBe(result.buffer.length);
    const root = await mkdtemp(join(tmpdir(), "tashira-synthetic-upload-"));
    vi.stubEnv("STORAGE_ROOT", root);
    try {
      await storageUpload(result.fileName, result.buffer, result.mimeType);
      const stored = await readFile(join(root, result.fileName));
      expect(await sharp(stored).metadata()).toMatchObject({ format: "jpeg", width: 640, height: 480 });
      expect((await sharp(stored).stats()).isOpaque).toBe(true);
      await expect(readFile(join(root, "test.heic"))).rejects.toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 60_000);

  it("accepts a 15-20 MB JPEG and compresses it below 3 MB", async () => {
    const bytes = await sharp(randomBytes(3600 * 3600 * 3), { raw: { width: 3600, height: 3600, channels: 3 } }).jpeg({ quality: 100, chromaSubsampling: "4:2:0" }).toBuffer();
    expect(bytes.length).toBeGreaterThan(15 * 1024 * 1024);
    expect(bytes.length).toBeLessThanOrEqual(MAX_DOCUMENT_FILE_SIZE);
    const result = await prepareDocumentUpload(input(bytes, "large.jpg", "image/jpeg"));
    expect(result.fileSize).toBeLessThan(3 * 1024 * 1024);
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBeGreaterThanOrEqual(2400);
    expect(metadata.width).toBeLessThanOrEqual(3000);
  }, 60_000);

  it("accepts HEIF when the phone omits MIME and rejects malformed photos with actionable guidance", async () => {
    expect(documentMimeType("", "PHONE.HEIF")).toBe("image/heif");
    const bytes = await readFile(new URL("./fixtures/synthetic-upload.heic", import.meta.url));
    expect((await prepareDocumentUpload(input(bytes, "phone.heif", ""))).mimeType).toBe("image/jpeg");
    await expect(prepareDocumentUpload(input(Buffer.from("not a photo"), "bad.heic", "image/heic"))).rejects.toThrow(PHOTO_CONVERSION_GUIDANCE);
  }, 60_000);

  it("rejects unsupported, spoofed, empty, oversize and mismatched content before storage", async () => {
    await expect(prepareDocumentUpload(input(Buffer.from("docx"), "test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).rejects.toThrow("Most Compatible");
    await expect(prepareDocumentUpload(input(Buffer.from("docx"), "spoof.pdf", "application/pdf"))).rejects.toThrow("File type not allowed");
    await expect(prepareDocumentUpload(input(Buffer.alloc(0), "empty.jpg", "image/jpeg"))).rejects.toThrow("20 MB");
    await expect(prepareDocumentUpload({ ...input(Buffer.from("x"), "big.jpg", "image/jpeg"), fileSize: MAX_DOCUMENT_FILE_SIZE + 1 })).rejects.toThrow("20 MB");
    await expect(prepareDocumentUpload({ ...input(Buffer.from("x"), "wrong.jpg", "image/jpeg"), fileSize: 3 })).rejects.toThrow("does not match");
  });
});
