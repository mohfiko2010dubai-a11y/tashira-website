export type AuditEvent =
  | "admin.login"
  | "admin.logout"
  | "staff.login"
  | "staff.logout"
  | "application.status_change"
  | "document.upload"
  | "document.delete"
  | "payment.intent_create"
  | "payment.readiness_rejected"
  | "payment.confirm";

export function auditLog(
  event: AuditEvent,
  outcome: "success" | "failure",
  actor: "anonymous" | "admin" | "staff" | "customer" | "system",
): void {
  console.info(JSON.stringify({
    type: "security_audit",
    event,
    outcome,
    actor,
    timestamp: new Date().toISOString(),
  }));
}
