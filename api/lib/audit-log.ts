export type AuditEvent =
  | "admin.login"
  | "staging-owner.login"
  | "admin.password_change"
  | "admin.logout"
  | "staff.login"
  | "staff.logout"
  | "application.status_change"
  | "document.upload"
  | "document.delete"
  | "payment.intent_create"
  | "payment.readiness_rejected"
  | "payment.confirm"
  | "customer.recovery_requested"
  | "customer.recovery_verified"
  | "email.notification"
  | "content.create"
  | "content.edit"
  | "content.review"
  | "content.publish"
  | "content.unpublish"
  | "content.archive"
  | "content.redirect";

export function auditLog(
  event: AuditEvent,
  outcome: "success" | "failure",
  actor: "anonymous" | "admin" | "staff" | "customer" | "system" | `staff:${number}`,
): void {
  console.info(JSON.stringify({
    type: "security_audit",
    event,
    outcome,
    actor,
    timestamp: new Date().toISOString(),
  }));
}
