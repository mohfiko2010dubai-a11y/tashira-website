export const EMAIL_TEMPLATES = [
  "APPLICATION_RECEIVED", "PAYMENT_SUCCESS", "PAYMENT_FAILED", "DOCUMENTS_REQUIRED",
  "SUBMITTED", "STATUS_CHANGED", "VISA_ISSUED", "RESUME_LINK", "RECOVERY_OTP",
] as const;

export type EmailTemplate = typeof EMAIL_TEMPLATES[number];

export interface TransactionalEmailProvider {
  readonly name: string;
  send(input: { recipient: string; template: EmailTemplate; variables: Record<string, string> }): Promise<{ reference: string }>;
}

export class DisabledEmailProvider implements TransactionalEmailProvider {
  readonly name = "disabled";
  async send(): Promise<{ reference: string }> {
    throw new Error("Transactional email delivery is not enabled in this environment");
  }
}

export function validateTemplateVariables(template: EmailTemplate, variables: Record<string, string>) {
  const required: Record<EmailTemplate, string[]> = {
    APPLICATION_RECEIVED: ["referenceNumber"],
    PAYMENT_SUCCESS: ["referenceNumber", "invoiceNumber"],
    PAYMENT_FAILED: ["referenceNumber"],
    DOCUMENTS_REQUIRED: ["referenceNumber"],
    SUBMITTED: ["referenceNumber"],
    STATUS_CHANGED: ["referenceNumber", "statusLabel"],
    VISA_ISSUED: ["referenceNumber"],
    RESUME_LINK: ["referenceNumber", "resumeUrl"],
    RECOVERY_OTP: ["referenceNumber", "otp", "expiresMinutes"],
  };
  const missing = required[template].filter((key) => !variables[key]);
  if (missing.length) throw new Error(`Missing email template variables: ${missing.join(", ")}`);
}

export function renderTransactionalEmail(template: EmailTemplate, variables: Record<string, string>) {
  validateTemplateVariables(template, variables);
  const reference = variables.referenceNumber;
  const content: Record<EmailTemplate, { subject: string; body: string }> = {
    APPLICATION_RECEIVED: { subject: `Application received — ${reference}`, body: `We received application ${reference}.` },
    PAYMENT_SUCCESS: { subject: `Payment successful — ${reference}`, body: `Payment was verified. Invoice: ${variables.invoiceNumber}.` },
    PAYMENT_FAILED: { subject: `Payment needs attention — ${reference}`, body: `The payment was not completed. No visa-processing claim is being made.` },
    DOCUMENTS_REQUIRED: { subject: `Documents required — ${reference}`, body: `Additional documents are required. Sign in securely to review the request.` },
    SUBMITTED: { subject: `Ready for processing — ${reference}`, body: `Application ${reference} is submitted and ready for TASHIRA processing.` },
    STATUS_CHANGED: { subject: `Application status updated — ${reference}`, body: `The current TASHIRA status is: ${variables.statusLabel}.` },
    VISA_ISSUED: { subject: `Visa issued — ${reference}`, body: `The authoritative application status now records the visa as issued.` },
    RESUME_LINK: { subject: `Secure application resume link — ${reference}`, body: `Resume your application: ${variables.resumeUrl}\nThis single-use link expires shortly.` },
    RECOVERY_OTP: { subject: `Application recovery code — ${reference}`, body: `Your one-time code is ${variables.otp}. It expires in ${variables.expiresMinutes} minutes.` },
  };
  return content[template];
}
