import { createHash } from "node:crypto";
import { renderTransactionalEmail, type EmailTemplate, type TransactionalEmailProvider } from "./transactional-email";

type ResendConfig = { apiKey: string; fromName: string; fromEmail: string; allowedRecipients: ReadonlySet<string>; staging: boolean };

export class ResendEmailProvider implements TransactionalEmailProvider {
  readonly name = "resend";
  constructor(private readonly config: ResendConfig, private readonly request: typeof fetch = fetch) {
    if (!config.apiKey.startsWith("re_")) throw new Error("Resend API key is not configured");
    if (!config.staging) throw new Error("Resend provider is restricted to staging");
  }

  async send(input: { recipient: string; template: EmailTemplate; variables: Record<string, string> }) {
    const recipient = input.recipient.trim().toLowerCase();
    if (!this.config.allowedRecipients.has(recipient)) throw new Error("Recipient is not approved for staging email UAT");
    const rendered = renderTransactionalEmail(input.template, input.variables);
    const response = await this.request("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${this.config.fromName} <${this.config.fromEmail}>`, to: [recipient], subject: `[STAGING] ${rendered.subject}`, text: rendered.body }),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string };
    if (!response.ok || !payload.id) throw new Error("Resend delivery failed");
    return { reference: payload.id };
  }
}

export function recipientHash(recipient: string) {
  return createHash("sha256").update(recipient.trim().toLowerCase()).digest("hex");
}
