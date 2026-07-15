import {
  pgTable, serial, text, varchar, integer, boolean, timestamp,
  decimal, date, pgEnum, index, uniqueIndex, jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", [
  "admin", "librarian", "staff", "member", "finance", "readonly",
]);
export const memberTypeEnum = pgEnum("member_type", [
  "student", "faculty", "staff", "external",
]);
export const materialTypeEnum = pgEnum("material_type", [
  "book", "journal", "magazine", "newspaper", "av_material",
  "map", "manuscript", "thesis", "digital", "other",
]);
export const copyStatusEnum = pgEnum("copy_status", [
  "available", "issued", "reserved", "in_binding", "in_maintenance",
  "lost", "withdrawn",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "issue", "return", "renew", "reserve", "cancel_reserve",
  "ill_out", "ill_in", "overnight",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "draft", "approved", "sent", "partial", "received", "cancelled",
]);
export const requisitionStatusEnum = pgEnum("requisition_status", [
  "pending", "approved", "ordered", "rejected",
]);
export const serialFrequencyEnum = pgEnum("serial_frequency", [
  "daily", "weekly", "fortnightly", "monthly", "quarterly",
  "half_yearly", "annually", "irregular",
]);
export const issueStatusEnum = pgEnum("serial_issue_status", [
  "expected", "received", "missing", "claimed", "bound",
]);
export const fineStatusEnum = pgEnum("fine_status", [
  "pending", "paid", "waived",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "overdue", "due_soon", "reservation_ready", "order_reminder",
  "new_arrival", "fine_receipt", "announcement",
]);
export const stockSessionStatusEnum = pgEnum("stock_session_status", [
  "in_progress", "completed", "cancelled",
]);

// ─── System Config ────────────────────────────────────────────────────────────
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Users (staff / admin accounts) ─────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("member"),
  memberId: integer("member_id"),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Members ─────────────────────────────────────────────────────────────────
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  membershipNo: varchar("membership_no", { length: 50 }).notNull().unique(),
  barcode: varchar("barcode", { length: 100 }).unique(),
  name: varchar("name", { length: 200 }).notNull(),
  memberType: memberTypeEnum("member_type").notNull().default("student"),
  department: varchar("department", { length: 100 }),
  course: varchar("course", { length: 100 }),
  rollNo: varchar("roll_no", { length: 50 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  photoUrl: text("photo_url"),
  membershipStartDate: date("membership_start_date"),
  membershipEndDate: date("membership_end_date"),
  maxBooks: integer("max_books").notNull().default(3),
  maxDays: integer("max_days").notNull().default(14),
  maxRenewals: integer("max_renewals").notNull().default(2),
  finePerDay: decimal("fine_per_day", { precision: 10, scale: 2 }).default("1.00"),
  isActive: boolean("is_active").notNull().default(true),
  isSuspended: boolean("is_suspended").notNull().default(false),
  suspendedUntil: date("suspended_until"),
  totalFinesPaid: decimal("total_fines_paid", { precision: 10, scale: 2 }).default("0.00"),
  totalFinesDue: decimal("total_fines_due", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("members_barcode_idx").on(t.barcode),
  index("members_email_idx").on(t.email),
  index("members_dept_idx").on(t.department),
  // The USN identifies exactly one student — enforced at the DB level so no code
  // path (manual add, CSV import, migration) can create a duplicate. Partial so
  // non-student members without a roll_no (faculty/staff/external) can share NULL.
  uniqueIndex("members_roll_no_unique").on(t.rollNo).where(sql`${t.rollNo} IS NOT NULL`),
]);

// ─── Catalogue Items (bibliographic records) ──────────────────────────────────
export const catalogueItems = pgTable("catalogue_items", {
  id: serial("id").primaryKey(),
  // --- Accession identifiers ---
  accessionNo: varchar("accession_no", { length: 50 }).notNull().unique(),
  titleNo: varchar("title_no", { length: 50 }),
  // --- Bibliographic ---
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  materialType: materialTypeEnum("material_type").notNull().default("book"),
  category: varchar("category", { length: 200 }),
  authors: text("authors").array(),
  editors: text("editors").array(),
  guide: varchar("guide", { length: 300 }),
  publisher: varchar("publisher", { length: 300 }),
  publicationYear: integer("publication_year"),
  publicationPlace: varchar("publication_place", { length: 200 }),
  edition: varchar("edition", { length: 100 }),
  volume: varchar("volume", { length: 100 }),
  series: varchar("series", { length: 300 }),
  isbn: varchar("isbn", { length: 50 }),
  issn: varchar("issn", { length: 50 }),
  deweyNo: varchar("dewey_no", { length: 100 }),
  callNumber: varchar("call_number", { length: 200 }),
  subjects: text("subjects").array(),
  keywords: text("keywords").array(),
  language: varchar("language", { length: 50 }).default("English"),
  pages: integer("pages"),
  bindingType: varchar("binding_type", { length: 100 }),
  department: varchar("department", { length: 300 }),
  // --- Acquisition / financial ---
  source: varchar("source", { length: 300 }),
  vendorName: varchar("vendor_name", { length: 300 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  netCost: decimal("net_cost", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 100 }).default("INR"),
  percentDiscount: decimal("percent_discount", { precision: 5, scale: 2 }),
  billDate: date("bill_date"),
  billNo: varchar("bill_no", { length: 200 }),
  entryDate: date("entry_date"),
  // --- Location / status ---
  location: varchar("location", { length: 200 }),
  section: varchar("section", { length: 200 }),
  homeBranch: varchar("home_branch", { length: 200 }),
  currentBranch: varchar("current_branch", { length: 200 }),
  accessionStatus: varchar("accession_status", { length: 100 }),
  // --- Digital / media ---
  softCopyPath: text("soft_copy_path"),
  softCopyPicPath: text("soft_copy_pic_path"),
  coverImageUrl: text("cover_image_url"),
  // --- Custom / extra ---
  custField1: text("cust_field1"),
  custField2: text("cust_field2"),
  custField3: text("cust_field3"),
  custField4: text("cust_field4"),
  remarks: text("remarks"),
  abstract: text("abstract"),
  notes: text("notes"),
  marcData: jsonb("marc_data"),
  // --- Counts & meta ---
  shelfNo: varchar("shelf_no", { length: 50 }),
  rackNo: varchar("rack_no", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  totalCopies: integer("total_copies").notNull().default(0),
  availableCopies: integer("available_copies").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("catalogue_title_idx").on(t.title),
  index("catalogue_isbn_idx").on(t.isbn),
  index("catalogue_dewey_idx").on(t.deweyNo),
  index("catalogue_type_idx").on(t.materialType),
  index("catalogue_title_no_idx").on(t.titleNo),
]);

// ─── Copies (physical items) ──────────────────────────────────────────────────
export const copies = pgTable("copies", {
  id: serial("id").primaryKey(),
  catalogueItemId: integer("catalogue_item_id").notNull().references(() => catalogueItems.id),
  barcode: varchar("barcode", { length: 100 }).notNull().unique(),
  copyNo: integer("copy_no").notNull().default(1),
  status: copyStatusEnum("status").notNull().default("available"),
  location: varchar("location", { length: 100 }),
  shelfNo: varchar("shelf_no", { length: 50 }),
  purchaseDate: date("purchase_date"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  vendorId: integer("vendor_id"),
  condition: varchar("condition", { length: 50 }).default("good"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("copies_barcode_idx").on(t.barcode),
  index("copies_catalogue_idx").on(t.catalogueItemId),
  index("copies_status_idx").on(t.status),
]);

// ─── Circulation Transactions ─────────────────────────────────────────────────
export const circTransactions = pgTable("circ_transactions", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => members.id),
  copyId: integer("copy_id").notNull().references(() => copies.id),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  issueDate: timestamp("issue_date"),
  dueDate: date("due_date"),
  returnDate: timestamp("return_date"),
  renewalCount: integer("renewal_count").notNull().default(0),
  fineAmount: decimal("fine_amount", { precision: 10, scale: 2 }).default("0.00"),
  fineStatus: fineStatusEnum("fine_status").default("pending"),
  finePaidAt: timestamp("fine_paid_at"),
  staffId: integer("staff_id").references(() => users.id),
  notes: text("notes"),
  isIll: boolean("is_ill").notNull().default(false),
  illLibrary: varchar("ill_library", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("circ_member_idx").on(t.memberId),
  index("circ_copy_idx").on(t.copyId),
  index("circ_due_idx").on(t.dueDate),
  index("circ_type_idx").on(t.transactionType),
]);

// ─── Reservations ─────────────────────────────────────────────────────────────
export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => members.id),
  catalogueItemId: integer("catalogue_item_id").notNull().references(() => catalogueItems.id),
  copyId: integer("copy_id").references(() => copies.id),
  reservedAt: timestamp("reserved_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  notifiedAt: timestamp("notified_at"),
  fulfilledAt: timestamp("fulfilled_at"),
  cancelledAt: timestamp("cancelled_at"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("res_member_idx").on(t.memberId),
  index("res_item_idx").on(t.catalogueItemId),
]);

// ─── Vendors ─────────────────────────────────────────────────────────────────
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  code: varchar("code", { length: 50 }).unique(),
  contactPerson: varchar("contact_person", { length: 200 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 30 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("India"),
  gstNo: varchar("gst_no", { length: 20 }),
  panNo: varchar("pan_no", { length: 20 }),
  bankDetails: jsonb("bank_details"),
  rating: decimal("rating", { precision: 3, scale: 1 }),
  totalOrders: integer("total_orders").default(0),
  deliveryRating: decimal("delivery_rating", { precision: 3, scale: 1 }),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Purchase Requisitions ────────────────────────────────────────────────────
export const purchaseRequisitions = pgTable("purchase_requisitions", {
  id: serial("id").primaryKey(),
  reqNo: varchar("req_no", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  authors: text("authors"),
  publisher: varchar("publisher", { length: 300 }),
  edition: varchar("edition", { length: 100 }),
  isbn: varchar("isbn", { length: 50 }),
  estimatedPrice: decimal("estimated_price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 100 }).default("INR"),
  quantity: integer("quantity").notNull().default(1),
  department: varchar("department", { length: 100 }),
  purpose: text("purpose"),
  requestedBy: integer("requested_by").references(() => members.id),
  staffId: integer("staff_id").references(() => users.id),
  status: requisitionStatusEnum("status").notNull().default("pending"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  purchaseOrderId: integer("purchase_order_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Purchase Orders ──────────────────────────────────────────────────────────
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNo: varchar("po_no", { length: 50 }).notNull().unique(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  orderDate: date("order_date").notNull(),
  expectedDelivery: date("expected_delivery"),
  status: orderStatusEnum("status").notNull().default("draft"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 100 }).default("INR"),
  budgetHeadId: integer("budget_head_id"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
  receivedAt: timestamp("received_at"),
  invoiceNo: varchar("invoice_no", { length: 100 }),
  invoiceDate: date("invoice_date"),
  invoiceAmount: decimal("invoice_amount", { precision: 12, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0.00"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Purchase Order Items ─────────────────────────────────────────────────────
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrders.id),
  catalogueItemId: integer("catalogue_item_id").references(() => catalogueItems.id),
  requisitionId: integer("requisition_id").references(() => purchaseRequisitions.id),
  title: text("title").notNull(),
  authors: text("authors"),
  isbn: varchar("isbn", { length: 50 }),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0.00"),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  receivedQty: integer("received_qty").default(0),
  notes: text("notes"),
});

// ─── Serials (Journals) ───────────────────────────────────────────────────────
export const serials = pgTable("serials", {
  id: serial("id").primaryKey(),
  catalogueItemId: integer("catalogue_item_id").references(() => catalogueItems.id),
  title: text("title").notNull(),
  issn: varchar("issn", { length: 50 }),
  publisher: varchar("publisher", { length: 300 }),
  frequency: serialFrequencyEnum("frequency").notNull().default("monthly"),
  startVolume: integer("start_volume"),
  startYear: integer("start_year"),
  subscriptionStart: date("subscription_start"),
  subscriptionEnd: date("subscription_end"),
  vendorId: integer("vendor_id").references(() => vendors.id),
  annualCost: decimal("annual_cost", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 100 }).default("INR"),
  location: varchar("location", { length: 100 }),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Serial Issues ────────────────────────────────────────────────────────────
export const serialIssues = pgTable("serial_issues", {
  id: serial("id").primaryKey(),
  serialId: integer("serial_id").notNull().references(() => serials.id),
  volume: integer("volume"),
  issueNo: varchar("issue_no", { length: 50 }),
  issueDate: date("issue_date"),
  expectedDate: date("expected_date"),
  receivedDate: date("received_date"),
  status: issueStatusEnum("status").notNull().default("expected"),
  barcode: varchar("barcode", { length: 100 }),
  location: varchar("location", { length: 100 }),
  bindingDate: date("binding_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("serial_issues_serial_idx").on(t.serialId),
  index("serial_issues_status_idx").on(t.status),
]);

// ─── Fine Records ─────────────────────────────────────────────────────────────
export const fineRecords = pgTable("fine_records", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => members.id),
  transactionId: integer("transaction_id").references(() => circTransactions.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  status: fineStatusEnum("status").notNull().default("pending"),
  collectedBy: integer("collected_by").references(() => users.id),
  collectedAt: timestamp("collected_at"),
  waivedBy: integer("waived_by").references(() => users.id),
  waivedAt: timestamp("waived_at"),
  receiptNo: varchar("receipt_no", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("fine_member_idx").on(t.memberId),
  index("fine_status_idx").on(t.status),
]);

// ─── Budget Heads ─────────────────────────────────────────────────────────────
export const budgetHeads = pgTable("budget_heads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  type: varchar("type", { length: 20 }).notNull().default("expense"),
  financialYear: varchar("financial_year", { length: 20 }).notNull(),
  department: varchar("department", { length: 100 }),
  allocatedAmount: decimal("allocated_amount", { precision: 12, scale: 2 }).default("0.00"),
  spentAmount: decimal("spent_amount", { precision: 12, scale: 2 }).default("0.00"),
  parentId: integer("parent_id"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Digital Library ──────────────────────────────────────────────────────────
export const digitalResources = pgTable("digital_resources", {
  id: serial("id").primaryKey(),
  catalogueItemId: integer("catalogue_item_id").references(() => catalogueItems.id),
  title: text("title").notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull().default("article"),
  authors: text("authors").array(),
  source: varchar("source", { length: 300 }),
  fileUrl: text("file_url"),
  externalUrl: text("external_url"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  subjects: text("subjects").array(),
  keywords: text("keywords").array(),
  language: varchar("language", { length: 50 }).default("English"),
  publicationYear: integer("publication_year"),
  abstract: text("abstract"),
  dublinCoreMetadata: jsonb("dublin_core_metadata"),
  isPublic: boolean("is_public").notNull().default(true),
  downloadCount: integer("download_count").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Stock Verification Sessions ─────────────────────────────────────────────
export const stockSessions = pgTable("stock_sessions", {
  id: serial("id").primaryKey(),
  sessionName: varchar("session_name", { length: 200 }).notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  status: stockSessionStatusEnum("status").notNull().default("in_progress"),
  totalExpected: integer("total_expected").default(0),
  totalVerified: integer("total_verified").default(0),
  totalMissing: integer("total_missing").default(0),
  conductedBy: integer("conducted_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stockVerifications = pgTable("stock_verifications", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => stockSessions.id),
  copyId: integer("copy_id").notNull().references(() => copies.id),
  verifiedAt: timestamp("verified_at").defaultNow(),
  scannedBarcode: varchar("scanned_barcode", { length: 100 }),
  isMissing: boolean("is_missing").notNull().default(false),
  isWithdrawn: boolean("is_withdrawn").notNull().default(false),
  notes: text("notes"),
}, (t) => [
  index("sv_session_idx").on(t.sessionId),
]);

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id),
  type: notificationTypeEnum("type").notNull(),
  subject: varchar("subject", { length: 300 }).notNull(),
  body: text("body").notNull(),
  emailTo: varchar("email_to", { length: 255 }),
  sentAt: timestamp("sent_at"),
  failedAt: timestamp("failed_at"),
  failReason: text("fail_reason"),
  isBulk: boolean("is_bulk").notNull().default(false),
  relatedId: integer("related_id"),
  relatedType: varchar("related_type", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("notif_member_idx").on(t.memberId),
  index("notif_type_idx").on(t.type),
]);

// ─── Library Gate Visits (entry/exit tracking via USN barcode) ───────────────
export const libraryVisits = pgTable("library_visits", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => members.id),
  entryTime: timestamp("entry_time").notNull().defaultNow(),
  exitTime: timestamp("exit_time"),
  durationMinutes: integer("duration_minutes"),
  autoClosed: boolean("auto_closed").notNull().default(false),
  scannedBy: integer("scanned_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("visits_member_idx").on(t.memberId),
  index("visits_entry_idx").on(t.entryTime),
  index("visits_open_idx").on(t.exitTime),
]);

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 100 }).notNull(),
  entityId: integer("entity_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("audit_user_idx").on(t.userId),
  index("audit_entity_idx").on(t.entity),
  index("audit_created_idx").on(t.createdAt),
]);

// ─── Relations ────────────────────────────────────────────────────────────────
export const catalogueRelations = relations(catalogueItems, ({ many }) => ({
  copies: many(copies),
  reservations: many(reservations),
  digitalResources: many(digitalResources),
}));

export const copiesRelations = relations(copies, ({ one, many }) => ({
  catalogueItem: one(catalogueItems, {
    fields: [copies.catalogueItemId],
    references: [catalogueItems.id],
  }),
  transactions: many(circTransactions),
}));

export const membersRelations = relations(members, ({ many }) => ({
  transactions: many(circTransactions),
  reservations: many(reservations),
  fines: many(fineRecords),
  notifications: many(notifications),
  visits: many(libraryVisits),
}));

export const libraryVisitsRelations = relations(libraryVisits, ({ one }) => ({
  member: one(members, { fields: [libraryVisits.memberId], references: [members.id] }),
  staff: one(users, { fields: [libraryVisits.scannedBy], references: [users.id] }),
}));

export const circTransactionsRelations = relations(circTransactions, ({ one }) => ({
  member: one(members, { fields: [circTransactions.memberId], references: [members.id] }),
  copy: one(copies, { fields: [circTransactions.copyId], references: [copies.id] }),
  staff: one(users, { fields: [circTransactions.staffId], references: [users.id] }),
}));

export const serialsRelations = relations(serials, ({ many }) => ({
  issues: many(serialIssues),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  vendor: one(vendors, { fields: [purchaseOrders.vendorId], references: [vendors.id] }),
  items: many(purchaseOrderItems),
}));
