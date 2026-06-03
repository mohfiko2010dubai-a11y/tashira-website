import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  decimal,
  json,
  bigint,
} from "drizzle-orm/mysql-core";

// ===== USERS (OAuth auth) =====
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ===== APPLICATIONS =====
export const applications = mysqlTable("applications", {
  id: serial("id").primaryKey(),
  referenceNumber: varchar("reference_number", { length: 20 }).notNull().unique(),
  baseType: mysqlEnum("base_type", ["single", "family"]).notNull(),
  residenceType: mysqlEnum("residence_type", ["non-gcc", "gcc-resident", "non-gcc-accompany", "gcc-accompany"]).notNull(),
  visaType: varchar("visa_type", { length: 50 }).notNull(),
  processingType: mysqlEnum("processing_type", ["regular", "express"]).default("regular").notNull(),
  // Shared contact
  contactEmail: varchar("contact_email", { length: 320 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 50 }).notNull(),
  arrivalDate: varchar("arrival_date", { length: 20 }),
  // Pricing
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  // Supplier
  supplierId: bigint("supplier_id", { mode: "number", unsigned: true }),
  supplierCost: decimal("supplier_cost", { precision: 10, scale: 2 }),
  // Status
  status: mysqlEnum("status", [
    "submitted",
    "payment_received",
    "documents_pending",
    "documents_received",
    "under_review",
    "visa_processing",
    "visa_received",
    "completed",
    "rejected",
    "cancelled",
  ]).default("submitted").notNull(),
  // Payment
  paymentStatus: mysqlEnum("payment_status", ["pending", "paid", "failed"]).default("pending").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }),
  // Invoice
  invoiceNumber: varchar("invoice_number", { length: 50 }),
  invoicePdfPath: varchar("invoice_pdf_path", { length: 255 }),
  invoicePdfUrl: varchar("invoice_pdf_url", { length: 255 }),
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;

// ===== APPLICANTS =====
export const applicants = mysqlTable("applicants", {
  id: serial("id").primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  applicantIndex: int("applicant_index").notNull(), // 0, 1, 2...
  fullName: varchar("full_name", { length: 255 }).notNull(),
  nationality: varchar("nationality", { length: 100 }),
  passportNumber: varchar("passport_number", { length: 100 }),
  passportType: varchar("passport_type", { length: 50 }),
  travelingFrom: varchar("traveling_from", { length: 100 }),
  passportExpiry: varchar("passport_expiry", { length: 20 }),
  profession: varchar("profession", { length: 100 }),
  // GCC fields
  gccResidenceNumber: varchar("gcc_residence_number", { length: 100 }),
  gccResidenceCountry: varchar("gcc_residence_country", { length: 100 }),
  // Accompany fields
  sponsorName: varchar("sponsor_name", { length: 255 }),
  sponsorRelation: varchar("sponsor_relation", { length: 50 }),
  // File URLs (stored as JSON array)
  fileUrls: json("file_urls"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Applicant = typeof applicants.$inferSelect;
export type InsertApplicant = typeof applicants.$inferInsert;

// ===== PAYMENTS =====
export const payments = mysqlTable("payments", {
  id: serial("id").primaryKey(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("usd").notNull(),
  status: mysqlEnum("status", ["pending", "succeeded", "failed"]).default("pending").notNull(),
  cardLast4: varchar("card_last4", { length: 4 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ===== INVOICES =====
export const invoices = mysqlTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  applicationId: bigint("application_id", { mode: "number", unsigned: true }).notNull(),
  paymentId: bigint("payment_id", { mode: "number", unsigned: true }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["generated", "sent", "viewed"]).default("generated").notNull(),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ===== SUPPLIERS (Vendors) =====
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

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ===== CHAT MESSAGES (AI Chatbot) =====
export const chatMessages = mysqlTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
