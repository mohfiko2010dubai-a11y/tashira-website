import {
  mysqlTable,
  serial,
  varchar,
  timestamp,
  text,
  mysqlEnum,
  decimal,
  bigint,
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
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }).default("3.6725").notNull(),
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
});

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
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5.00").notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  pdfPath: varchar("pdf_path", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = mysqlTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
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
