export const EMAIL_TEMPLATES = [
  "APPLICATION_RECEIVED", "PAYMENT_SUCCESS", "PAYMENT_FAILED", "DOCUMENTS_REQUIRED",
  "SUBMITTED", "VISA_ISSUED", "RESUME_LINK",
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
    VISA_ISSUED: ["referenceNumber"],
    RESUME_LINK: ["referenceNumber", "resumeUrl"],
  };
  const missing = required[template].filter((key) => !variables[key]);
  if (missing.length) throw new Error(`Missing email template variables: ${missing.join(", ")}`);
}
