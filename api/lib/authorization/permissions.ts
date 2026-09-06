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
  "content.view",
  "content.create",
  "content.edit",
  "content.review",
  "content.publish",
  "content.unpublish",
  "content.archive",
  "content.manage_seo",
  "content.manage_redirects",
  "content.manage_media",
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
  | "AI_ASSISTANT"
  | "CONTENT_WRITER"
  | "CONTENT_REVIEWER"
  | "SEO_MANAGER";

export const ROLE_TEMPLATES: Readonly<Record<RoleTemplate, readonly Permission[]>> = {
  OPERATIONS_EMPLOYEE: [
    "case.read_assigned", "case.transition", "applicant.read", "document.read",
    "document.review", "supplier.read_operational", "rule.read",
  ],
  OPERATIONS_MANAGER: [
    "case.read", "case.assign", "case.transition", "applicant.read", "document.read",
    "document.review", "supplier.read_operational", "rule.read",
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
  CONTENT_WRITER: ["content.view", "content.create", "content.edit"],
  CONTENT_REVIEWER: ["content.view", "content.edit", "content.review"],
  SEO_MANAGER: ["content.view", "content.manage_seo", "content.manage_redirects", "content.manage_media"],
};
