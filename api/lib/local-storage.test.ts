import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  resolveStoragePath,
  storageCreateSignedUrl,
  storageDelete,
  storageUpload,
} from "./local-storage";

let temporaryRoot: string;
let originalStorageRoot: string | undefined;

beforeEach(() => {
  originalStorageRoot = process.env.STORAGE_ROOT;
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tashira-storage-"));
  process.env.STORAGE_ROOT = temporaryRoot;
});

afterEach(() => {
  if (originalStorageRoot === undefined) delete process.env.STORAGE_ROOT;
  else process.env.STORAGE_ROOT = originalStorageRoot;
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

describe("local document storage", () => {
  it("writes, resolves, serves, and deletes the same canonical relative path", async () => {
    const relativePath = "applications/42/passport/passport.pdf";
    const contents = Buffer.from("test document");

    const uploaded = await storageUpload(relativePath, contents, "application/pdf");
    const fullPath = resolveStoragePath(relativePath);
    const signed = await storageCreateSignedUrl(relativePath);

    expect(uploaded.path).toBe(relativePath);
    expect(fs.readFileSync(fullPath)).toEqual(contents);
    expect(signed.signedUrl).toBe(`/storage/${relativePath}`);

    await storageDelete(relativePath);
    expect(fs.existsSync(fullPath)).toBe(false);
  });

  it.each(["../outside.txt", "applications/../../outside.txt", ""])(
    "rejects a path outside the storage root: %s",
    (unsafePath) => {
      expect(() => resolveStoragePath(unsafePath)).toThrow("Invalid storage path");
    },
  );
});
