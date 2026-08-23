export const PERMISSIONS = [
  "case.read",
  "case.read_assigned",
  "case.assign",
  "case.transition",
  "applicant.read",
  "document.read",
  "document.review",
  "support.read",
  "support.reply",
  "supplier.read_operational",
  "supplier.read_financial",
  "finance.read_revenue",
  "finance.read_cost",
  "finance.read_margin",
  "rule.read",
  "rule.propose",
  "rule.review",
  "rule.activate",
  "role.manage",
  "authority.record_submission",
] as const;

export type Permission = typeof PERMISSIONS[number];

export const RESOURCE_SCOPES = ["OWN", "ASSIGNED", "TEAM", "DEPARTMENT", "ALL"] as const;
export type ResourceScope = typeof RESOURCE_SCOPES[number];

export type RoleTemplate =
  | "OPERATIONS_EMPLOYEE"
  | "OPERATIONS_MANAGER"
  | "FINANCE_MANAGER"
  | "CUSTOMER_SERVICE"
  | "OWNER"
  | "AI_ASSISTANT";

export const ROLE_TEMPLATES: Readonly<Record<RoleTemplate, readonly Permission[]>> = {
  OPERATIONS_EMPLOYEE: [
    "case.read_assigned", "case.transition", "applicant.read", "document.read",
    "document.review", "supplier.read_operational",
  ],
  OPERATIONS_MANAGER: [
    "case.read", "case.assign", "case.transition", "applicant.read", "document.read",
    "document.review", "supplier.read_operational",
  ],
  FINANCE_MANAGER: [
    "finance.read_revenue", "finance.read_cost", "finance.read_margin",
    "supplier.read_financial",
  ],
  CUSTOMER_SERVICE: [
    "case.read_assigned", "applicant.read", "support.read", "support.reply",
  ],
  OWNER: [],
  AI_ASSISTANT: [],
};
