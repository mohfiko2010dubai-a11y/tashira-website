import {
  mysqlTable,
  serial,
  varchar,
  timestamp,
  datetime,
  text,
  mysqlEnum,
  decimal,
  bigint,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("union_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  avatar: varchar("avatar", { length: 500 }),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const applications = mysqlTable("applications", {
  id: serial("id").primaryKey(),
  referenceNumber: varchar("reference_number", { length: 50 }).notNull().unique(),
  baseType: mysqlEnum("base_type", ["single", "family"]).notNull(),
  residenceType: mysqlEnum("residence_type", ["non-gcc", "gcc-resident", "non-gcc-accompany", "gcc-accompany"]).notNull(),
  visaType: varchar("visa_type", { length: 50 }).notNull(),
  processingType: mysqlEnum("processing_type", ["regular", "express"]).notNull(),
  contactEmail: varchar("contact_email", { length: 320 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 50 }).notNull(),
  arrivalDate: varchar("arrival_date", { length: 20 }),
  // Currency fields
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }).notNull(),
  totalAmountAed: decimal("total_amount_aed", { precision: 10, scale: 2 }).notNull(),
  totalAmountUsd: decimal("total_amount_usd", { precision: 10, scale: 2 }),
  // Supplier fields
  supplierId: bigint("supplier_id", { mode: "number", unsigned: true }),
  supplierCostAed: decimal("supplier_cost_aed", { precision: 10, scale: 2 }),
  supplierVatStatus: mysqlEnum("supplier_vat_status", ["standard", "zero_rated", "exempt", "out_of_scope"]),
  supplierPlaceOfSupply: mysqlEnum("supplier_place_of_supply", ["within_uae", "outside_uae"]),
  supplierVatAmount: decimal("supplier_vat_amount", { precision: 10, scale: 2 }),
  supplierTotalAed: decimal("supplier_total_aed", { precision: 10, scale: 2 }),
  supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 100 }),
  supplierPaid: mysqlEnum("supplier_paid", ["pending", "paid"]).default("pending"),
  supplierNotes: text("supplier_notes"),
  status: mysqlEnum("status", ["submitted","payment_received","documents_pending","documents_received","under_review","visa_processing","visa_received","completed","rejected","cancelled"]).default("submitted").notNull(),
  paymentStatus: mysqlEnum("payment_status", ["pending","paid","failed"]).default("pending").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }),
  stripeAmountUsd: decimal("stripe_amount_usd", { precision: 10, scale: 2 }),
  invoiceNumber: varchar("invoice_number", { length: 50 }),
  invoicePdfPath: varchar("invoice_pdf_path", { length: 255 }),
  invoicePdfUrl: varchar("invoice_pdf_url", { length: 255 }),
  dataClassification: mysqlEnum("data_classification", ["LIVE", "TEST"]).default("LIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const applicants = mysqlTable("applicants", {
  id: serial("id").primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  applicantIndex: bigint("applicant_index", { mode: "number", unsigned: true }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  nationality: varchar("nationality", { length: 100 }),
  passportNumber: varchar("passport_number", { length: 100 }),
  passportType: varchar("passport_type", { length: 50 }),
  travelingFrom: varchar("traveling_from", { length: 100 }),
  passportExpiry: varchar("passport_expiry", { length: 20 }),
  profession: varchar("profession", { length: 100 }),
  gccResidenceNumber: varchar("gcc_residence_number", { length: 100 }),
  gccResidenceCountry: varchar("gcc_residence_country", { length: 100 }),
  sponsorName: varchar("sponsor_name", { length: 255 }),
  sponsorRelation: varchar("sponsor_relation", { length: 50 }),
}, (table) => [
  uniqueIndex("applicant_application_index_uq").on(table.applicationId, table.applicantIndex),
]);

export const payments = mysqlTable("payments", {
  id: serial("id").primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["pending", "succeeded", "failed"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = mysqlTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  paymentId: bigint("payment_id", { mode: "number", unsigned: true }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  pdfPath: varchar("pdf_path", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = mysqlTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant", "admin"]).notNull(),
  content: text("content").notNull(),
  visitorName: varchar("visitor_name", { length: 255 }),
  visitorEmail: varchar("visitor_email", { length: 320 }),
  visitorPhone: varchar("visitor_phone", { length: 50 }),
  isRead: mysqlEnum("is_read", ["unread", "read"]).default("unread").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suppliers = mysqlTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  isActive: mysqlEnum("is_active", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const staffUsers = mysqlTable("staff_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  isActive: mysqlEnum("is_active", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const documents = mysqlTable("documents", {
  id: serial("id").primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  applicantId: bigint("applicant_id", { mode: "number", unsigned: true }),
  documentType: mysqlEnum("document_type", [
    "passport",
    "photo",
    "national_id",
    "supporting",
    "visa",
    "invoice",
    "gcc_residence",
    "sponsor_id",
  ]).notNull(),
  originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
  storedFileName: varchar("stored_file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: bigint("file_size", { mode: "number", unsigned: true }).notNull(),
  storageProvider: varchar("storage_provider", { length: 50 }).default("supabase").notNull(),
  storageBucket: varchar("storage_bucket", { length: 100 }).default("tashira-documents").notNull(),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  uploadStatus: mysqlEnum("upload_status", ["pending", "uploaded", "failed", "replaced"]).default("pending").notNull(),
  uploadedBy: varchar("uploaded_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const stripeWebhookEvents = mysqlTable("stripe_webhook_events", {
  eventId: varchar("event_id", { length: 255 }).primaryKey(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  paymentIntentId: varchar("payment_intent_id", { length: 255 }).notNull(),
  processingStatus: mysqlEnum("processing_status", ["processing", "processed", "failed"]).notNull(),
  attemptCount: bigint("attempt_count", { mode: "number", unsigned: true }).notNull().default(1),
  processedAt: datetime("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("stripe_webhook_payment_intent_idx").on(table.paymentIntentId, table.createdAt),
]);

export const applicationTimelineEvents = mysqlTable("application_timeline_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  paymentId: bigint("payment_id", { mode: "number", unsigned: true }),
  sessionReference: varchar("session_reference", { length: 100 }),
  eventName: varchar("event_name", { length: 80 }).notNull(),
  eventSource: varchar("event_source", { length: 40 }).notNull(),
  actorType: mysqlEnum("actor_type", ["CUSTOMER", "STAFF", "ADMIN", "SYSTEM", "STRIPE"]).notNull(),
  actorReference: varchar("actor_reference", { length: 100 }),
  sanitizedCategory: varchar("sanitized_category", { length: 80 }),
  attemptNumber: bigint("attempt_number", { mode: "number", unsigned: true }),
  resultingState: varchar("resulting_state", { length: 50 }),
  policyVersion: varchar("policy_version", { length: 50 }),
  evidenceHash: varchar("evidence_hash", { length: 64 }),
  summary: varchar("summary", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pricingRules = mysqlTable("pricing_rules", {
  id: serial("id").primaryKey(),
  serviceCode: varchar("service_code", { length: 80 }).notNull(),
  processingType: mysqlEnum("pricing_processing_type", ["regular", "express"]).notNull(),
  version: bigint("version", { mode: "number", unsigned: true }).notNull(),
  supplierCost: decimal("supplier_cost", { precision: 12, scale: 2 }).notNull(),
  internalCost: decimal("internal_cost", { precision: 12, scale: 2 }).notNull(),
  markup: decimal("markup", { precision: 12, scale: 2 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 12, scale: 2 }).notNull(),
  promotionalPrice: decimal("promotional_price", { precision: 12, scale: 2 }),
  minimumSellingPrice: decimal("minimum_selling_price", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("pricing_currency", { length: 3 }).notNull(),
  effectiveAt: datetime("effective_at").notNull(),
  expiresAt: datetime("expires_at"),
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("pricing_rule_version_uq").on(table.serviceCode, table.processingType, table.version),
  index("pricing_rule_active_idx").on(table.serviceCode, table.processingType, table.effectiveAt, table.expiresAt),
]);

export const applicationPriceSnapshots = mysqlTable("application_price_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull().unique(),
  pricingRuleId: bigint("pricing_rule_id", { mode: "number", unsigned: true }).notNull(),
  pricingVersion: bigint("pricing_version", { mode: "number", unsigned: true }).notNull(),
  applicantCount: bigint("applicant_count", { mode: "number", unsigned: true }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  supplierCost: decimal("snapshot_supplier_cost", { precision: 12, scale: 2 }).notNull(),
  internalCost: decimal("snapshot_internal_cost", { precision: 12, scale: 2 }).notNull(),
  markup: decimal("snapshot_markup", { precision: 12, scale: 2 }).notNull(),
  minimumSellingPrice: decimal("snapshot_minimum_selling_price", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("snapshot_currency", { length: 3 }).notNull(),
  exchangeRateToBase: decimal("exchange_rate_to_base", { precision: 14, scale: 6 }).notNull(),
  baseCurrency: varchar("snapshot_base_currency", { length: 3 }).notNull(),
  totalInBaseCurrency: decimal("total_in_base_currency", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "price_snapshot_application_fk", columns: [table.applicationId], foreignColumns: [applications.id] }).onDelete("restrict"),
  foreignKey({ name: "price_snapshot_rule_fk", columns: [table.pricingRuleId], foreignColumns: [pricingRules.id] }).onDelete("restrict"),
]);

export const businessSettingsVersions = mysqlTable("business_settings_versions", {
  id: serial("id").primaryKey(),
  version: bigint("settings_version", { mode: "number", unsigned: true }).notNull().unique(),
  legalName: varchar("legal_name", { length: 255 }).notNull(),
  address: text("company_address").notNull(),
  phone: varchar("company_phone", { length: 50 }).notNull(),
  email: varchar("company_email", { length: 320 }).notNull(),
  vatRegistered: mysqlEnum("vat_registered", ["yes", "no"]).notNull(),
  trn: varchar("trn", { length: 100 }),
  vatRate: decimal("settings_vat_rate", { precision: 7, scale: 4 }).notNull(),
  vatEffectiveAt: datetime("vat_effective_at"),
  registrationThreshold: decimal("registration_threshold", { precision: 14, scale: 2 }),
  warningLevelsJson: text("warning_levels_json").notNull(),
  invoicePrefix: varchar("invoice_prefix", { length: 20 }).notNull(),
  nextInvoiceNumber: bigint("next_invoice_number", { mode: "number", unsigned: true }).notNull(),
  baseCurrency: varchar("base_currency", { length: 3 }).notNull(),
  usdToBaseRate: decimal("usd_to_base_rate", { precision: 14, scale: 6 }).notNull(),
  effectiveAt: datetime("settings_effective_at").notNull(),
  createdBy: varchar("settings_created_by", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const financialEvents = mysqlTable("financial_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }),
  paymentId: bigint("payment_id", { mode: "number", unsigned: true }),
  eventType: mysqlEnum("financial_event_type", ["REFUND_REQUESTED", "REFUND_COMPLETED", "CHARGEBACK_OPENED", "CHARGEBACK_WON", "CHARGEBACK_LOST"]).notNull(),
  amount: decimal("financial_event_amount", { precision: 12, scale: 2 }),
  currency: varchar("financial_event_currency", { length: 3 }),
  sourceReference: varchar("source_reference", { length: 100 }),
  actorReference: varchar("financial_actor_reference", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("financial_event_application_idx").on(table.applicationId, table.createdAt),
  index("financial_event_payment_idx").on(table.paymentId, table.createdAt),
  foreignKey({ name: "financial_event_application_fk", columns: [table.applicationId], foreignColumns: [applications.id] }).onDelete("restrict"),
  foreignKey({ name: "financial_event_payment_fk", columns: [table.paymentId], foreignColumns: [payments.id] }).onDelete("restrict"),
]);

export const securityDepositRequests = mysqlTable("security_deposit_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: mysqlEnum("security_deposit_status", [
    "DRAFT", "SENT", "ACCEPTED", "DECLINED", "PAYMENT_PENDING", "PAID",
    "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED", "EXPIRED",
  ]).default("DRAFT").notNull(),
  purpose: varchar("purpose", { length: 255 }).notNull(),
  accessTokenHash: varchar("access_token_hash", { length: 64 }).notNull().unique(),
  expiresAt: datetime("expires_at").notNull(),
  requestedBy: varchar("requested_by", { length: 100 }).notNull(),
  sentAt: datetime("sent_at"),
  acceptedAt: datetime("accepted_at"),
  declinedAt: datetime("declined_at"),
  paidAt: datetime("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("security_deposit_application_idx").on(table.applicationId, table.createdAt),
  foreignKey({ name: "security_deposit_application_fk", columns: [table.applicationId], foreignColumns: [applications.id] }).onDelete("restrict"),
]);

export const securityDepositPayments = mysqlTable("security_deposit_payments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }).notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: mysqlEnum("security_deposit_payment_status", ["PENDING", "SUCCEEDED", "FAILED"]).default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("security_deposit_payment_request_uq").on(table.requestId),
  foreignKey({ name: "security_deposit_payment_request_fk", columns: [table.requestId], foreignColumns: [securityDepositRequests.id] }).onDelete("restrict"),
]);

export const refundCases = mysqlTable("refund_cases", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("refund_case_status", [
    "DRAFT", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "PARTIALLY_REFUNDED",
    "REFUNDED", "FAILED", "CANCELLED",
  ]).default("DRAFT").notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  policyVersion: varchar("policy_version", { length: 50 }).notNull(),
  requestedBy: varchar("requested_by", { length: 100 }).notNull(),
  approvedBy: varchar("approved_by", { length: 100 }),
  approvedAt: datetime("approved_at"),
  completedAt: datetime("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("refund_case_application_idx").on(table.applicationId, table.createdAt),
  foreignKey({ name: "refund_case_application_fk", columns: [table.applicationId], foreignColumns: [applications.id] }).onDelete("restrict"),
]);

export const refundItems = mysqlTable("refund_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  refundCaseId: varchar("refund_case_id", { length: 36 }).notNull(),
  sourceType: mysqlEnum("refund_source_type", ["VISA_SERVICE", "SECURITY_DEPOSIT"]).notNull(),
  paymentId: bigint("payment_id", { mode: "number", unsigned: true }),
  securityDepositPaymentId: varchar("security_deposit_payment_id", { length: 36 }),
  originalAmount: decimal("original_amount", { precision: 12, scale: 2 }).notNull(),
  requestedAmount: decimal("requested_amount", { precision: 12, scale: 2 }).notNull(),
  deductionType: mysqlEnum("refund_deduction_type", ["NONE", "PERCENTAGE", "FIXED", "ACTUAL_COSTS"]).notNull(),
  deductionValue: decimal("deduction_value", { precision: 12, scale: 4 }).notNull(),
  refundAmount: decimal("refund_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: mysqlEnum("refund_item_status", ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"]).default("PENDING").notNull(),
  stripeRefundId: varchar("stripe_refund_id", { length: 100 }).unique(),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull().unique(),
  failureCategory: varchar("failure_category", { length: 80 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("refund_item_case_idx").on(table.refundCaseId, table.createdAt),
  foreignKey({ name: "refund_item_case_fk", columns: [table.refundCaseId], foreignColumns: [refundCases.id] }).onDelete("restrict"),
  foreignKey({ name: "refund_item_payment_fk", columns: [table.paymentId], foreignColumns: [payments.id] }).onDelete("restrict"),
  foreignKey({ name: "refund_item_deposit_payment_fk", columns: [table.securityDepositPaymentId], foreignColumns: [securityDepositPayments.id] }).onDelete("restrict"),
]);

export const applicationRiskAssessments = mysqlTable("application_risk_assessments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  level: mysqlEnum("risk_level", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]).notNull(),
  score: bigint("risk_score", { mode: "number", unsigned: true }).notNull(),
  factorsJson: text("risk_factors_json").notNull(),
  modelVersion: varchar("risk_model_version", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("risk_application_created_idx").on(table.applicationId, table.createdAt),
  foreignKey({ name: "risk_application_fk", columns: [table.applicationId], foreignColumns: [applications.id] }).onDelete("restrict"),
]);

export const retentionPolicies = mysqlTable("retention_policies", {
  id: serial("id").primaryKey(),
  category: mysqlEnum("retention_category", ["IDENTITY_DOCUMENTS", "APPLICATION_RECORDS", "PAYMENT_RECORDS", "CHARGEBACK_EVIDENCE", "AUDIT_LOGS"]).notNull(),
  durationDays: bigint("duration_days", { mode: "number", unsigned: true }),
  version: bigint("retention_version", { mode: "number", unsigned: true }).notNull(),
  effectiveAt: datetime("retention_effective_at").notNull(),
  createdBy: varchar("retention_created_by", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("retention_policy_version_uq").on(table.category, table.version)]);

export const retentionRecords = mysqlTable("retention_records", {
  id: varchar("id", { length: 36 }).primaryKey(),
  category: mysqlEnum("record_retention_category", ["IDENTITY_DOCUMENTS", "APPLICATION_RECORDS", "PAYMENT_RECORDS", "CHARGEBACK_EVIDENCE", "AUDIT_LOGS"]).notNull(),
  subjectType: varchar("retention_subject_type", { length: 50 }).notNull(),
  subjectReference: varchar("retention_subject_reference", { length: 100 }).notNull(),
  retentionStart: datetime("retention_start").notNull(),
  scheduledDeletionAt: datetime("scheduled_deletion_at"),
  legalHoldActive: mysqlEnum("legal_hold_active", ["yes", "no"]).default("no").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("retention_subject_uq").on(table.category, table.subjectType, table.subjectReference),
  index("retention_due_hold_idx").on(table.scheduledDeletionAt, table.legalHoldActive),
]);

export const legalHoldEvents = mysqlTable("legal_hold_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  retentionRecordId: varchar("retention_record_id", { length: 36 }).notNull(),
  action: mysqlEnum("legal_hold_action", ["PLACED", "RELEASED"]).notNull(),
  reason: varchar("legal_hold_reason", { length: 255 }).notNull(),
  authorizedActor: varchar("legal_hold_actor", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("legal_hold_record_created_idx").on(table.retentionRecordId, table.createdAt),
  foreignKey({ name: "legal_hold_record_fk", columns: [table.retentionRecordId], foreignColumns: [retentionRecords.id] }).onDelete("restrict"),
]);

export const deletionAuditEvents = mysqlTable("deletion_audit_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  retentionRecordId: varchar("deletion_retention_record_id", { length: 36 }).notNull(),
  outcome: mysqlEnum("deletion_outcome", ["BLOCKED_LEGAL_HOLD", "ELIGIBLE", "DELETED", "FAILED"]).notNull(),
  actorReference: varchar("deletion_actor_reference", { length: 100 }).notNull(),
  details: varchar("deletion_details", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("deletion_audit_record_created_idx").on(table.retentionRecordId, table.createdAt),
  foreignKey({ name: "deletion_audit_record_fk", columns: [table.retentionRecordId], foreignColumns: [retentionRecords.id] }).onDelete("restrict"),
]);

export const customerRecoveryChallenges = mysqlTable("customer_recovery_challenges", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: bigint("recovery_application_id", { mode: "number", unsigned: true }).notNull(),
  channel: mysqlEnum("recovery_channel", ["MAGIC_LINK", "EMAIL_OTP", "SMS_OTP"]).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  destinationHash: varchar("destination_hash", { length: 64 }).notNull(),
  expiresAt: datetime("recovery_expires_at").notNull(),
  consumedAt: datetime("recovery_consumed_at"),
  attemptCount: bigint("recovery_attempt_count", { mode: "number", unsigned: true }).default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("recovery_application_idx").on(table.applicationId, table.createdAt),
  index("recovery_token_expiry_idx").on(table.tokenHash, table.expiresAt),
  foreignKey({ name: "recovery_application_fk", columns: [table.applicationId], foreignColumns: [applications.id] }).onDelete("restrict"),
]);

export const outboundEmailEvents = mysqlTable("outbound_email_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: bigint("email_application_id", { mode: "number", unsigned: true }),
  template: mysqlEnum("email_template", ["APPLICATION_RECEIVED", "PAYMENT_SUCCESS", "PAYMENT_FAILED", "DOCUMENTS_REQUIRED", "SUBMITTED", "STATUS_CHANGED", "VISA_ISSUED", "RESUME_LINK", "RECOVERY_OTP", "SECURITY_DEPOSIT_REQUEST", "REFUND_COMPLETED"]).notNull(),
  sourceReference: varchar("source_reference", { length: 100 }),
  recipientHash: varchar("recipient_hash", { length: 64 }).notNull(),
  provider: varchar("email_provider", { length: 50 }).notNull(),
  status: mysqlEnum("email_status", ["QUEUED", "SENT", "FAILED", "SUPPRESSED"]).notNull(),
  providerReference: varchar("email_provider_reference", { length: 100 }),
  failureCategory: varchar("email_failure_category", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("outbound_email_application_idx").on(table.applicationId, table.createdAt),
  uniqueIndex("outbound_email_template_source_uq").on(table.template, table.sourceReference),
  foreignKey({ name: "outbound_email_application_fk", columns: [table.applicationId], foreignColumns: [applications.id] }).onDelete("restrict"),
]);

export const documentLifecycleEvents = mysqlTable("document_lifecycle_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: bigint("document_event_application_id", { mode: "number", unsigned: true }).notNull(),
  documentId: bigint("document_event_document_id", { mode: "number", unsigned: true }),
  applicantId: bigint("document_event_applicant_id", { mode: "number", unsigned: true }),
  replacesDocumentId: bigint("replaces_document_id", { mode: "number", unsigned: true }),
  eventType: mysqlEnum("document_lifecycle_event_type", ["UPLOADED", "REPLACED", "DELETED", "REPLACEMENT_REQUESTED", "VALIDATED", "REJECTED"]).notNull(),
  documentVersion: bigint("document_version", { mode: "number", unsigned: true }).notNull(),
  actorType: mysqlEnum("document_event_actor_type", ["CUSTOMER", "STAFF", "ADMIN", "SYSTEM"]).notNull(),
  actorReference: varchar("document_event_actor_reference", { length: 100 }),
  evidenceReference: varchar("document_evidence_reference", { length: 100 }),
  reason: varchar("document_event_reason", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("document_lifecycle_application_idx").on(table.applicationId, table.createdAt),
  index("document_lifecycle_document_idx").on(table.documentId, table.createdAt),
  index("document_lifecycle_applicant_idx").on(table.applicantId, table.createdAt),
  foreignKey({ name: "document_lifecycle_application_fk", columns: [table.applicationId], foreignColumns: [applications.id] }).onDelete("restrict"),
  foreignKey({ name: "document_lifecycle_applicant_fk", columns: [table.applicantId], foreignColumns: [applicants.id] }).onDelete("restrict"),
]);
