import {
  mysqlTable,
  serial,
  varchar,
  timestamp,
  text,
  json,
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
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  supplierId: bigint("supplier_id", { mode: "number", unsigned: true }),
  supplierCost: decimal("supplier_cost", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["submitted","payment_received","documents_pending","documents_received","under_review","visa_processing","visa_received","completed","rejected","cancelled"]).default("submitted").notNull(),
  paymentStatus: mysqlEnum("payment_status", ["pending","paid","failed"]).default("pending").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }),
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
