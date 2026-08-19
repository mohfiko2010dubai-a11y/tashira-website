export const EMAIL_TEMPLATES = [
  "APPLICATION_RECEIVED", "PAYMENT_SUCCESS", "PAYMENT_FAILED", "DOCUMENTS_REQUIRED",
  "SUBMITTED", "STATUS_CHANGED", "VISA_ISSUED", "RESUME_LINK", "RECOVERY_OTP",
] as const;

export type EmailTemplate = typeof EMAIL_TEMPLATES[number];

export type TransactionalEmailAttachment = {
  filename: string;
  content: string;
};

export interface TransactionalEmailProvider {
  readonly name: string;
  send(input: { recipient: string; template: EmailTemplate; variables: Record<string, string>; idempotencyKey?: string; attachments?: readonly TransactionalEmailAttachment[] }): Promise<{ reference: string }>;
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
    PAYMENT_SUCCESS: ["referenceNumber", "invoiceNumber", "amountPaid", "currency", "currentStatus", "invoiceUrl"],
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
    PAYMENT_SUCCESS: {
      subject: `Payment successful — ${reference}`,
      body: `Your payment was verified. Application: ${reference}. Invoice: ${variables.invoiceNumber}. Amount paid: ${variables.amountPaid} ${variables.currency}. Current status: ${variables.currentStatus}. View or download your invoice securely: ${variables.invoiceUrl}. Next step: TASHIRA will review the paid application. Payment confirmation does not mean government submission.${variables.trackingUrl ? ` Track securely: ${variables.trackingUrl}` : ""}`,
    },
    PAYMENT_FAILED: { subject: `Payment needs attention — ${reference}`, body: `The payment was not completed. No visa-processing claim is being made.` },
    DOCUMENTS_REQUIRED: { subject: `Documents required — ${reference}`, body: `Additional documents are required. Sign in securely to review the request.` },
    SUBMITTED: { subject: `Ready for processing — ${reference}`, body: `Application ${reference} is submitted and ready for TASHIRA processing.` },
    STATUS_CHANGED: { subject: `Application status updated — ${reference}`, body: `The current TASHIRA status is: ${variables.statusLabel}.` },
    VISA_ISSUED: { subject: `Visa issued — ${reference}`, body: `The authoritative application status now records the visa as issued.` },
    RESUME_LINK: { subject: `Secure application resume link — ${reference}`, body: `Resume your application: ${variables.resumeUrl}\nThis single-use link expires shortly.` },
    RECOVERY_OTP: { subject: `Application recovery code — ${reference}`, body: `Your one-time code is ${variables.otp}. It expires in ${variables.expiresMinutes} minutes.` },
  };
  const rendered = content[template];
  if (template === "PAYMENT_SUCCESS") {
    const invoiceUrl = new URL(variables.invoiceUrl);
    const expectedInvoicePath = `/invoice-download/${encodeURIComponent(variables.invoiceNumber)}`;
    if (
      invoiceUrl.protocol !== "https:" ||
      invoiceUrl.origin !== "https://staging.tashiraev.com" ||
      invoiceUrl.pathname !== expectedInvoicePath ||
      !/^\d+$/.test(invoiceUrl.searchParams.get("expires") || "") ||
      !/^[A-Za-z0-9_-]{43}$/.test(invoiceUrl.searchParams.get("signature") || "") ||
      [...invoiceUrl.searchParams.keys()].some((key) => !["expires", "signature"].includes(key)) ||
      invoiceUrl.hash ||
      invoiceUrl.username ||
      invoiceUrl.password
    ) {
      throw new Error("Invoice email URL is not an approved authorized staging URL");
    }
    const escapedInvoiceUrl = escapeHtml(invoiceUrl.toString());
    const trackingLink = variables.trackingUrl
      ? `<p><a href="${escapeHtml(variables.trackingUrl)}" style="display:inline-block;background:#d9ad55;color:#172235;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">Track Application</a></p>`
      : "";
    return {
      ...rendered,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172235;line-height:1.5"><h1 style="font-size:22px">Payment Successful</h1><p>Your payment has been authoritatively verified.</p><p>Application: <strong>${escapeHtml(reference)}</strong><br>Invoice: <strong>${escapeHtml(variables.invoiceNumber)}</strong><br>Amount paid: <strong>${escapeHtml(variables.amountPaid)} ${escapeHtml(variables.currency)}</strong><br>Status: <strong>${escapeHtml(variables.currentStatus)}</strong></p><p><a href="${escapedInvoiceUrl}" style="display:inline-block;background:#172235;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">View / Download Invoice</a></p><p>This invoice link requires your existing authorized application session.</p><p>Next step: TASHIRA will review the paid application. Payment confirmation does not mean government submission.</p>${trackingLink}</body></html>`,
    };
  }
  if (template !== "RESUME_LINK") return { ...rendered, html: undefined };

  const resumeUrl = new URL(variables.resumeUrl);
  if (resumeUrl.protocol !== "https:" || resumeUrl.origin !== "https://staging.tashiraev.com" || resumeUrl.pathname !== "/recover") {
    throw new Error("Recovery email URL is not an approved staging URL");
  }
  const escapedUrl = escapeHtml(resumeUrl.toString());
  const escapedReference = escapeHtml(reference);
  return {
    ...rendered,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172235;line-height:1.5"><h1 style="font-size:22px">Resume your TASHIRA application</h1><p>Application reference: <strong>${escapedReference}</strong></p><p><a href="${escapedUrl}" style="display:inline-block;background:#d9ad55;color:#172235;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">Resume Application</a></p><p>This secure single-use link expires shortly.</p><p>If the button does not work, copy this address into your browser:<br><a href="${escapedUrl}">${escapedUrl}</a></p></body></html>`,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}
