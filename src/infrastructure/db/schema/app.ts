import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { CustomFieldValues, SelectOption } from "@/domain/catalog/field-definition";
import { id, timestamps } from "./columns";

/** Money: integer paisa in bigint columns, read as JS numbers (safe up to ~৳90 trillion). */
const money = (name: string) => bigint(name, { mode: "number" });

export const settings = pgTable(
  "settings",
  {
    id: id(),
    singleton: boolean("singleton").notNull().default(true).unique(),
    shopNameBn: text("shop_name_bn"),
    shopNameEn: text("shop_name_en"),
    addressBn: text("address_bn"),
    addressEn: text("address_en"),
    phone: text("phone"),
    logoKey: text("logo_key"),
    receiptFooterBn: text("receipt_footer_bn"),
    receiptFooterEn: text("receipt_footer_en"),
    defaultLocale: text("default_locale").notNull().default("bn"),
    useBanglaDigits: boolean("use_bangla_digits").notNull().default(true),
    defaultCreditDays: integer("default_credit_days").notNull().default(30),
    salePrefix: text("sale_prefix").notNull().default("INV-"),
    receiptPrefix: text("receipt_prefix").notNull().default("RCP-"),
    autoLogoutMinutes: integer("auto_logout_minutes").notNull().default(30),
    starterSetDecidedAt: timestamp("starter_set_decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check("settings_singleton_ck", sql`${t.singleton}`)],
);

export const sequences = pgTable("sequences", {
  id: id(),
  kind: text("kind").notNull().unique(),
  nextValue: bigint("next_value", { mode: "number" }).notNull().default(1),
  ...timestamps,
});

export const categories = pgTable(
  "categories",
  {
    id: id(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
    nameBn: text("name_bn"),
    nameEn: text("name_en"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("categories_parent_idx").on(t.parentId),
    check("categories_name_ck", sql`coalesce(${t.nameBn}, ${t.nameEn}) is not null`),
  ],
);

export const fieldDefinitions = pgTable(
  "field_definitions",
  {
    id: id(),
    categoryId: uuid("category_id").references(() => categories.id),
    key: text("key").notNull(),
    labelBn: text("label_bn"),
    labelEn: text("label_en"),
    type: text("type").notNull(),
    options: jsonb("options").$type<SelectOption[]>().notNull().default([]),
    unitBn: text("unit_bn"),
    unitEn: text("unit_en"),
    isRequired: boolean("is_required").notNull().default(false),
    showOnReceipt: boolean("show_on_receipt").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("field_definitions_scope_key_uq").on(t.categoryId, t.key).nullsNotDistinct(),
    check("field_definitions_type_ck", sql`${t.type} in ('text','number','decimal','money','select','date','boolean')`),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    name: text("name").notNull(),
    nameBn: text("name_bn"),
    phone: text("phone").notNull().unique(),
    altPhone: text("alt_phone"),
    address: text("address"),
    photoKey: text("photo_key"),
    photoThumbKey: text("photo_thumb_key"),
    nidNumber: text("nid_number"),
    guarantorName: text("guarantor_name"),
    guarantorPhone: text("guarantor_phone"),
    guarantorRelation: text("guarantor_relation"),
    creditLimitMinor: money("credit_limit_minor"),
    isBlocked: boolean("is_blocked").notNull().default(false),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check("customers_phone_e164_ck", sql`${t.phone} ~ '^\\+8801[3-9][0-9]{8}$'`)],
);

export const sales = pgTable(
  "sales",
  {
    id: id(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    saleNumber: text("sale_number").notNull().unique(),
    saleDate: date("sale_date").notNull(),
    subtotalMinor: money("subtotal_minor").notNull(),
    discountMinor: money("discount_minor").notNull().default(0),
    totalMinor: money("total_minor").notNull(),
    status: text("status").notNull().default("open"),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key").unique(),
    cancelReason: text("cancel_reason"),
    ...timestamps,
  },
  (t) => [
    index("sales_customer_idx").on(t.customerId),
    index("sales_date_idx").on(t.saleDate),
    check("sales_status_ck", sql`${t.status} in ('open','closed','written_off','cancelled')`),
    check("sales_amounts_ck", sql`${t.subtotalMinor} >= 0 and ${t.discountMinor} >= 0 and ${t.totalMinor} = ${t.subtotalMinor} - ${t.discountMinor}`),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: id(),
    saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: money("unit_price_minor").notNull(),
    lineTotalMinor: money("line_total_minor").notNull(),
    customFields: jsonb("custom_fields").$type<CustomFieldValues>().notNull().default({}),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("sale_items_sale_idx").on(t.saleId),
    index("sale_items_category_idx").on(t.categoryId),
    check("sale_items_qty_ck", sql`${t.quantity} >= 1 and ${t.lineTotalMinor} = ${t.unitPriceMinor} * ${t.quantity}`),
  ],
);

export const saleItemPhotos = pgTable(
  "sale_item_photos",
  {
    id: id(),
    saleItemId: uuid("sale_item_id").notNull().references(() => saleItems.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    thumbKey: text("thumb_key").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("sale_item_photos_item_idx").on(t.saleItemId)],
);

export const adjustments = pgTable(
  "adjustments",
  {
    id: id(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    saleId: uuid("sale_id").references(() => sales.id),
    type: text("type").notNull(),
    direction: text("direction").notNull(),
    amountMinor: money("amount_minor").notNull(),
    reason: text("reason").notNull(),
    ...timestamps,
  },
  (t) => [
    index("adjustments_customer_idx").on(t.customerId),
    check("adjustments_type_ck", sql`${t.type} in ('opening_balance','return','discount','write_off','correction')`),
    check("adjustments_direction_ck", sql`${t.direction} in ('debit','credit')`),
    check("adjustments_amount_ck", sql`${t.amountMinor} > 0 and length(trim(${t.reason})) > 0`),
  ],
);

/** Obligations: a sale's schedule (seq 0 = upfront) or a debit adjustment. */
export const installments = pgTable(
  "installments",
  {
    id: id(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    saleId: uuid("sale_id").references(() => sales.id),
    adjustmentId: uuid("adjustment_id").references(() => adjustments.id),
    seq: integer("seq").notNull(),
    dueDate: date("due_date").notNull(),
    amountMinor: money("amount_minor").notNull(),
    ...timestamps,
  },
  (t) => [
    index("installments_customer_due_idx").on(t.customerId, t.dueDate),
    index("installments_sale_idx").on(t.saleId),
    uniqueIndex("installments_sale_seq_uq").on(t.saleId, t.seq).where(sql`${t.saleId} is not null`),
    check("installments_amount_ck", sql`${t.amountMinor} > 0`),
    check("installments_source_ck", sql`num_nonnulls(${t.saleId}, ${t.adjustmentId}) = 1`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    saleId: uuid("sale_id").references(() => sales.id),
    receiptNumber: text("receipt_number").notNull().unique(),
    amountMinor: money("amount_minor").notNull(),
    method: text("method").notNull(),
    reference: text("reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    note: text("note"),
    status: text("status").notNull().default("active"),
    voidReason: text("void_reason"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").unique(),
    isUpfront: boolean("is_upfront").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("payments_customer_idx").on(t.customerId, t.paidAt),
    index("payments_paid_at_idx").on(t.paidAt),
    check("payments_amount_ck", sql`${t.amountMinor} > 0`),
    check("payments_method_ck", sql`${t.method} in ('cash','bkash','nagad','rocket','bank','card','other')`),
    check("payments_status_ck", sql`${t.status} in ('active','voided')`),
    check("payments_void_ck", sql`${t.status} = 'active' or (${t.voidReason} is not null and ${t.voidedAt} is not null)`),
  ],
);

/** The single source of truth for what is paid. */
export const allocations = pgTable(
  "allocations",
  {
    id: id(),
    paymentId: uuid("payment_id").references(() => payments.id),
    adjustmentId: uuid("adjustment_id").references(() => adjustments.id),
    installmentId: uuid("installment_id").notNull().references(() => installments.id),
    amountMinor: money("amount_minor").notNull(),
    ...timestamps,
  },
  (t) => [
    index("allocations_installment_idx").on(t.installmentId),
    index("allocations_payment_idx").on(t.paymentId),
    index("allocations_adjustment_idx").on(t.adjustmentId),
    check("allocations_amount_ck", sql`${t.amountMinor} > 0`),
    check("allocations_source_ck", sql`num_nonnulls(${t.paymentId}, ${t.adjustmentId}) = 1`),
  ],
);

export const followUps = pgTable(
  "follow_ups",
  {
    id: id(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    saleId: uuid("sale_id").references(() => sales.id),
    channel: text("channel").notNull(),
    outcome: text("outcome").notNull(),
    note: text("note"),
    promisedAmountMinor: money("promised_amount_minor"),
    promisedDate: date("promised_date"),
    ...timestamps,
  },
  (t) => [
    index("follow_ups_customer_idx").on(t.customerId, t.createdAt),
    index("follow_ups_promised_idx").on(t.promisedDate),
    check("follow_ups_channel_ck", sql`${t.channel} in ('call','whatsapp','visit','in_shop')`),
    check("follow_ups_outcome_ck", sql`${t.outcome} in ('reached','no_answer','promised','refused')`),
    check("follow_ups_promise_ck", sql`${t.outcome} <> 'promised' or ${t.promisedDate} is not null`),
  ],
);

export const translationOverrides = pgTable(
  "translation_overrides",
  {
    id: id(),
    locale: text("locale").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    ...timestamps,
  },
  (t) => [unique("translation_overrides_locale_key_uq").on(t.locale, t.key)],
);

/** Append-only (a trigger rejects UPDATE/DELETE). */
export const activityLog = pgTable(
  "activity_log",
  {
    id: id(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    summary: text("summary").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("activity_log_at_idx").on(t.at), index("activity_log_entity_idx").on(t.entity, t.entityId)],
);
