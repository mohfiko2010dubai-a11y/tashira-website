/** Content identification only; image decoders still validate the complete file. */
export function documentContentType(bytes: Buffer): string | undefined {
  if (bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  // HEIF is ISO-BMFF. Read the declared major/compatible brands, never arbitrary
  // text elsewhere in the payload or the browser's MIME/filename hint.
  for (let offset = 0; offset + 16 <= Math.min(bytes.length, 65536);) {
    const size = bytes.readUInt32BE(offset);
    if (size < 8 || offset + size > bytes.length) return undefined;
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "ftyp") {
      if (size < 16 || size > 4096 || size % 4 !== 0) return undefined;
      const brands = [bytes.toString("ascii", offset + 8, offset + 12)];
      for (let i = offset + 16; i < offset + size; i += 4) brands.push(bytes.toString("ascii", i, i + 4));
      if (brands.some(brand => brand === "avif" || brand === "avis")) return undefined;
      return brands.some(brand => ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"].includes(brand)) ? "image/heif" : undefined;
    }
    if (type !== "free" && type !== "skip") return undefined;
    offset += size;
  }
  return undefined;
}
