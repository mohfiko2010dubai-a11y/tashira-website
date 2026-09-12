import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { TRPCError } from "@trpc/server";
import { documentMimeType, MAX_DOCUMENT_FILE_SIZE, PHOTO_CONVERSION_GUIDANCE, DOCUMENT_SIZE_GUIDANCE, UNSUPPORTED_DOCUMENT_GUIDANCE, UPLOAD_RETRY_GUIDANCE } from "../../contracts/document-upload-policy";
import { sanitizeDocumentFileName, validateDocumentFile } from "./document-upload";

type Input = { fileName: string; mimeType: string; fileSize: number; base64Data: string };
type WorkerResult = { bytes?: Uint8Array; mimeType?: string; converted?: boolean; error?: string };
let activeConversions = 0;

export async function prepareDocumentUpload(input: Input) {
  const mimeType = documentMimeType(input.mimeType, input.fileName);
  const invalid = validateDocumentFile(mimeType, input.fileSize);
  if (invalid) throw new TRPCError({ code: "BAD_REQUEST", message: invalid });
  if (input.base64Data.length > Math.ceil(MAX_DOCUMENT_FILE_SIZE / 3) * 4) throw new TRPCError({ code: "BAD_REQUEST", message: DOCUMENT_SIZE_GUIDANCE });
  const buffer = Buffer.from(input.base64Data, "base64");
  const mismatch = validateDocumentFile(mimeType, input.fileSize, buffer.length);
  if (mismatch) throw new TRPCError({ code: "BAD_REQUEST", message: mismatch });
  const fileName = sanitizeDocumentFileName(input.fileName);
  if (mimeType === "application/pdf") {
    if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new TRPCError({ code: "BAD_REQUEST", message: UNSUPPORTED_DOCUMENT_GUIDANCE });
    return { buffer, fileName: fileName.replace(/\.[^.]*$/, "") + ".pdf", mimeType, fileSize: buffer.length };
  }
  // Bound simultaneous decoder memory use; callers retain the selected file
  // and offer Retry if the server is temporarily busy.
  if (activeConversions >= 2) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: UPLOAD_RETRY_GUIDANCE });
  activeConversions++;
  try {
    const result = await new Promise<WorkerResult>((accept, reject) => {
      const worker = new Worker(resolve(process.cwd(), "api/lib/document-image-worker.mjs"), {
        workerData: { bytes: buffer, mimeType }, stdout: true, stderr: true,
        resourceLimits: { maxOldGenerationSizeMb: 384 },
      });
      // Native decoder diagnostics must never reach application logs.
      worker.stdout.resume(); worker.stderr.resume();
      const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Timeout")); }, 45_000);
      worker.once("message", (value: WorkerResult) => { clearTimeout(timer); accept(value); void worker.terminate(); });
      worker.once("error", () => { clearTimeout(timer); reject(new Error("Decode failed")); });
      worker.once("exit", () => { clearTimeout(timer); reject(new Error("Decode ended")); });
    });
    if (result.error || !result.bytes || !result.mimeType) throw new Error("Decode failed");
    const convertedBuffer = Buffer.from(result.bytes);
    return { buffer: convertedBuffer, fileName: fileName.replace(/\.[^.]*$/, "") + (result.mimeType === "image/png" ? ".png" : ".jpg"), mimeType: result.mimeType, fileSize: convertedBuffer.length };
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: PHOTO_CONVERSION_GUIDANCE });
  } finally { activeConversions--; }
}
