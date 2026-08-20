import { createHash } from "crypto";

export function hashEvidenceManifest(manifest: unknown) {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}
