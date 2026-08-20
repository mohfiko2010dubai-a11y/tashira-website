import { DisabledEmailProvider, type TransactionalEmailProvider } from "./transactional-email";
import { ResendEmailProvider } from "./resend-email";

export function transactionalEmailProvider(): TransactionalEmailProvider {
  const mode = process.env.EMAIL_MODE || process.env.STAGING_EMAIL_MODE;
  if (mode !== "resend") return new DisabledEmailProvider();
  const staging = process.env.APP_ID === "tashira-staging";
  const productionExplicitlyEnabled = process.env.ENABLE_PRODUCTION_EMAIL === "true";
  const allowedRecipients = new Set((process.env.STAGING_EMAIL_ALLOWED_RECIPIENTS || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  return new ResendEmailProvider({
    apiKey: process.env.RESEND_API_KEY || "",
    fromName: process.env.FROM_NAME || "TASHIRA Staging",
    fromEmail: process.env.FROM_EMAIL || "onboarding@resend.dev",
    allowedRecipients,
    restrictRecipients: staging,
    subjectPrefix: staging ? "[STAGING] " : "",
    enabled: staging || productionExplicitlyEnabled,
  });
}
