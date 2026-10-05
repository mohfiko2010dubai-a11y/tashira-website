import { DisabledEmailProvider, type TransactionalEmailProvider } from "./transactional-email";
import { ResendEmailProvider } from "./resend-email";

export function transactionalEmailProvider(): TransactionalEmailProvider {
  const mode = process.env.EMAIL_MODE || process.env.STAGING_EMAIL_MODE;
  if (mode !== "resend") return new DisabledEmailProvider();
  const from = process.env.FROM_EMAIL || '';
  const replyTo = process.env.EMAIL_REPLY_TO || from;
  if (![from, replyTo].every(address => /^[a-z0-9._%+-]+@tashiraev\.com$/i.test(address) && !/^no[._-]?reply@/i.test(address))) throw new Error('Configure a monitored TASHIRA sender and reply address before enabling transactional mail.');
  const staging = process.env.APP_ID === "tashira-staging";
  const productionExplicitlyEnabled = process.env.ENABLE_PRODUCTION_EMAIL === "true";
  const allowedRecipients = new Set((process.env.STAGING_EMAIL_ALLOWED_RECIPIENTS || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (staging && (!allowedRecipients.size || [...allowedRecipients].some(address => !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address)))) {
    throw new Error('Staging mail requires an explicit list of approved email addresses.');
  }
  return new ResendEmailProvider({
    apiKey: process.env.RESEND_API_KEY || "",
    fromName: process.env.FROM_NAME || "TASHIRA Staging",
    fromEmail: from,
    replyTo,
    allowedRecipients,
    allowedApplicationReferences: new Set((process.env.STAGING_EMAIL_ALLOWED_APPLICATION_REFERENCES || '').split(',').map(value => value.trim()).filter(Boolean)),
    restrictRecipients: staging,
    subjectPrefix: staging ? (process.env.TRANSACTIONAL_EMAIL_SUBJECT_PREFIX || "[STAGING] ") : "",
    enabled: staging || productionExplicitlyEnabled,
  });
}
export function emailWebhookSecret(): string { return process.env.RESEND_WEBHOOK_SECRET || ''; }
export function adminEmailRecipient(): string { return process.env.TRANSACTIONAL_ADMIN_EMAIL || ''; }
