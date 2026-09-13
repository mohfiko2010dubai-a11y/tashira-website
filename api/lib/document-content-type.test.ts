import { describe, expect, it } from "vitest";
import { documentContentType } from "./document-content-type";

describe("document content identification", () => {
  it("reads major and compatible HEIF brands, not arbitrary embedded text", () => {
    const ftyp = Buffer.alloc(24); ftyp.writeUInt32BE(24); ftyp.write("ftyp", 4); ftyp.write("mif1", 8); ftyp.write("heic", 16); ftyp.write("mif1", 20);
    expect(documentContentType(ftyp)).toBe("image/heif");
    const free = Buffer.alloc(8); free.writeUInt32BE(8); free.write("free", 4);
    expect(documentContentType(Buffer.concat([free, ftyp]))).toBe("image/heif");
    expect(documentContentType(Buffer.from("not an image but contains ftypheic"))).toBeUndefined();
    ftyp.write("avif", 16); expect(documentContentType(ftyp)).toBeUndefined();
    ftyp.writeUInt32BE(5000); expect(documentContentType(ftyp)).toBeUndefined();
  });
});
