import { createHash } from "node:crypto";
import { z } from "zod";

const verifiedInboundEmailSchema = z.object({
  verificationState: z.literal("VERIFIED"),
  providerCode: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_-]+$/),
  providerMessageId: z.string().trim().min(3).max(220),
  senderReferenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  receivedAt: z.string().datetime({ offset: true }),
  applicationId: z.number().int().positive(),
  applicationReference: z.string().trim().min(3).max(100),
  teamId: z.number().int().positive(),
  plainTextBody: z.string().min(1).max(20_000),
  attachmentCount: z.number().int().min(0).max(100).default(0),
}).strict();

export type VerifiedInboundEmail = z.infer<typeof verifiedInboundEmailSchema>;
export type NormalizedInboundSupportEmail = Omit<VerifiedInboundEmail, "plainTextBody" | "verificationState"> & {
  providerIdentity: string;
  sanitizedBody: string;
  evidenceSha256: string;
};

function sanitizeBody(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n");
  const printable = [...normalized].filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return character === "\n" || character === "\t" || code >= 32 && code !== 127;
  }).join("");
  const sanitized = printable
    .split("\n").map((line) => line.trimEnd()).join("\n").trim();
  if (!sanitized) throw new Error("INBOUND_EMAIL_BODY_REQUIRED");
  return sanitized.slice(0, 4_000);
}

/** Provider adapters must verify signatures before calling this boundary. Raw MIME, HTML, headers and attachments never cross it. */
export function normalizeVerifiedInboundEmail(input: unknown): NormalizedInboundSupportEmail {
  const parsed = verifiedInboundEmailSchema.parse(input);
  const sanitizedBody = sanitizeBody(parsed.plainTextBody);
  const providerIdentity = `${parsed.providerCode}:${parsed.providerMessageId}`;
  const evidenceSha256 = createHash("sha256").update(JSON.stringify({ providerIdentity, senderReferenceSha256: parsed.senderReferenceSha256,
    receivedAt: parsed.receivedAt, applicationId: parsed.applicationId, applicationReference: parsed.applicationReference,
    teamId: parsed.teamId, sanitizedBody, attachmentCount: parsed.attachmentCount })).digest("hex");
  return { providerCode: parsed.providerCode, providerMessageId: parsed.providerMessageId, senderReferenceSha256: parsed.senderReferenceSha256,
    receivedAt: parsed.receivedAt, applicationId: parsed.applicationId, applicationReference: parsed.applicationReference,
    teamId: parsed.teamId, attachmentCount: parsed.attachmentCount, providerIdentity, sanitizedBody, evidenceSha256 };
}
