import { DisabledEmailProvider, type TransactionalEmailProvider } from "./transactional-email";
import { ResendEmailProvider } from "./resend-email";

export function transactionalEmailProvider(): TransactionalEmailProvider {
  if (process.env.STAGING_EMAIL_MODE !== "resend") return new DisabledEmailProvider();
  const allowedRecipients = new Set((process.env.STAGING_EMAIL_ALLOWED_RECIPIENTS || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  return new ResendEmailProvider({
    apiKey: process.env.RESEND_API_KEY || "",
    fromName: process.env.FROM_NAME || "TASHIRA Staging",
    fromEmail: process.env.FROM_EMAIL || "onboarding@resend.dev",
    allowedRecipients,
    staging: process.env.APP_ID === "tashira-staging",
  });
}
