import { bigint, date, integer, pgView, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Balance views, created by hand-written SQL in drizzle/0002_ledger.sql.
 * Balances are never stored; they always come from allocations.
 */
export const installmentBalances = pgView("installment_balances", {
  id: uuid("id").notNull(),
  customerId: uuid("customer_id").notNull(),
  saleId: uuid("sale_id"),
  adjustmentId: uuid("adjustment_id"),
  seq: integer("seq").notNull(),
  dueDate: date("due_date").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  paidMinor: bigint("paid_minor", { mode: "number" }).notNull(),
  remainingMinor: bigint("remaining_minor", { mode: "number" }).notNull(),
  daysOverdue: integer("days_overdue").notNull(),
  status: text("status").notNull(),
}).existing();

export const saleBalances = pgView("sale_balances", {
  saleId: uuid("sale_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
  paidMinor: bigint("paid_minor", { mode: "number" }).notNull(),
  remainingMinor: bigint("remaining_minor", { mode: "number" }).notNull(),
  overdueMinor: bigint("overdue_minor", { mode: "number" }).notNull(),
  maxDaysOverdue: integer("max_days_overdue").notNull(),
  nextDueDate: date("next_due_date"),
}).existing();

export const customerBalances = pgView("customer_balances", {
  customerId: uuid("customer_id").notNull(),
  balanceMinor: bigint("balance_minor", { mode: "number" }).notNull(),
  overdueMinor: bigint("overdue_minor", { mode: "number" }).notNull(),
  maxDaysOverdue: integer("max_days_overdue").notNull(),
  nextDueDate: date("next_due_date"),
  lastPaymentAt: timestamp("last_payment_at", { withTimezone: true }),
}).existing();
