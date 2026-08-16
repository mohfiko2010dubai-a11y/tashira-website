import { createHash } from "node:crypto";
import { renderTransactionalEmail, type EmailTemplate, type TransactionalEmailProvider } from "./transactional-email";

type ResendConfig = {
  apiKey: string;
  fromName: string;
  fromEmail: string;
  allowedRecipients: ReadonlySet<string>;
  restrictRecipients: boolean;
  subjectPrefix: string;
  enabled: boolean;
};

export class ResendEmailProvider implements TransactionalEmailProvider {
  readonly name = "resend";
  private readonly config: ResendConfig;
  private readonly request: typeof fetch;
  constructor(config: ResendConfig, request: typeof fetch = fetch) {
    this.config = config;
    this.request = request;
    if (!config.apiKey.startsWith("re_")) throw new Error("Resend API key is not configured");
    if (!config.enabled) throw new Error("Resend provider is not enabled for this environment");
  }

  async send(input: { recipient: string; template: EmailTemplate; variables: Record<string, string>; idempotencyKey?: string }) {
    const recipient = input.recipient.trim().toLowerCase();
    if (this.config.restrictRecipients && !this.config.allowedRecipients.has(recipient)) throw new Error("Recipient is not approved for staging email UAT");
    const rendered = renderTransactionalEmail(input.template, input.variables);
    const response = await this.request("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: [recipient],
        subject: `${this.config.subjectPrefix}${rendered.subject}`,
        text: rendered.body,
        ...(rendered.html ? { html: rendered.html } : {}),
      }),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string };
    if (!response.ok || !payload.id) throw new Error("Resend delivery failed");
    return { reference: payload.id };
  }
}

export function recipientHash(recipient: string) {
  return createHash("sha256").update(recipient.trim().toLowerCase()).digest("hex");
}
