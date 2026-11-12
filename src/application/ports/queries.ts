import type { AgingBucket, InstallmentStatus } from "@/domain/collections/aging";
import type { PromiseStatus } from "@/domain/followup/follow-up";
import type { PaymentMethod } from "@/domain/payment/payment";
import type {
  AdjustmentRecord,
  CustomerRecord,
  FollowUpRecord,
  PaymentRecord,
  SaleItemRecord,
  SaleRecord,
} from "./records";

/* ---------- customers ---------- */

export type CustomerFilter = "all" | "has_dues" | "overdue" | "blocked" | "archived";

export interface CustomerListItem {
  id: string;
  name: string;
  nameBn: string | null;
  phone: string;
  photoThumbKey: string | null;
  isBlocked: boolean;
  archived: boolean;
  balanceMinor: number;
  overdueMinor: number;
  maxDaysOverdue: number;
  lastPaymentAt: Date | null;
}

export interface OpenSaleSummary {
  id: string;
  saleNumber: string;
  saleDate: string;
  totalMinor: number;
  remainingMinor: number;
  maxDaysOverdue: number;
  nextDueDate: string | null;
  status: SaleRecord["status"];
  items: { name: string; thumbKey: string | null }[];
}

export interface FollowUpView extends FollowUpRecord {
  promiseStatus: PromiseStatus | null;
  paidTowardMinor: number;
}

export interface CustomerProfile {
  customer: CustomerRecord;
  balanceMinor: number;
  overdueMinor: number;
  maxDaysOverdue: number;
  lastPaymentAt: Date | null;
  openSales: OpenSaleSummary[];
}

export type LedgerKind = "sale" | "payment" | "adjustment";

export interface LedgerEntry {
  at: Date;
  kind: LedgerKind;
  refId: string;
  ref: string;
  /** e.g. payment method, adjustment type */
  detail: string | null;
  debitMinor: number;
  creditMinor: number;
  balanceMinor: number;
  voided: boolean;
  cancelled: boolean;
}

/* ---------- sales ---------- */

export interface InstallmentView {
  id: string;
  seq: number;
  dueDate: string;
  amountMinor: number;
  paidMinor: number;
  remainingMinor: number;
  status: InstallmentStatus;
  daysOverdue: number;
}

export interface AppliedCredit {
  kind: "payment" | "adjustment";
  id: string;
  ref: string;
  at: Date;
  method: PaymentMethod | null;
  adjustmentType: AdjustmentRecord["type"] | null;
  amountMinor: number;
  isUpfront: boolean;
}

export interface SaleDetail {
  sale: SaleRecord & { createdAt: Date };
  customer: Pick<CustomerRecord, "id" | "name" | "nameBn" | "phone" | "photoThumbKey">;
  items: SaleItemRecord[];
  installments: InstallmentView[];
  applied: AppliedCredit[];
  paidMinor: number;
  remainingMinor: number;
  editable: boolean;
  cancellable: boolean;
}

/* ---------- payments ---------- */

export interface PaymentDetail {
  payment: PaymentRecord;
  customer: Pick<CustomerRecord, "id" | "name" | "nameBn" | "phone">;
  allocations: { saleId: string | null; saleNumber: string | null; seq: number; dueDate: string; amountMinor: number }[];
  customerBalanceMinor: number;
}

export interface AdjustmentView extends AdjustmentRecord {
  saleNumber: string | null;
}

/* ---------- collections ---------- */

export interface CollectionRow {
  customerId: string;
  name: string;
  nameBn: string | null;
  phone: string;
  photoThumbKey: string | null;
  productThumbKey: string | null;
  balanceMinor: number;
  /** overdue amount, or the amount due on the relevant date */
  amountMinor: number;
  maxDaysOverdue: number;
  nextDueDate: string | null;
  bucket: AgingBucket;
  lastFollowUp: { at: Date; outcome: FollowUpRecord["outcome"] } | null;
}

export interface PromiseRow extends CollectionRow {
  followUpId: string;
  promisedDate: string;
  promisedAmountMinor: number | null;
  paidTowardMinor: number;
  status: PromiseStatus;
}

export interface CollectionsView {
  promisesDueToday: PromiseRow[];
  brokenPromises: PromiseRow[];
  dueToday: CollectionRow[];
  overdue: CollectionRow[];
  /** due in the next 7 days */
  upcoming: CollectionRow[];
  /** everyone else with a balance: next due date more than 7 days away */
  later: CollectionRow[];
}

/* ---------- dashboard ---------- */

export interface DashboardView {
  totalOutstandingMinor: number;
  totalOverdueMinor: number;
  collectedTodayMinor: number;
  collectedMonthMinor: number;
  newCreditMonthMinor: number;
  customersWithDues: number;
  promisesDueToday: number;
  aging: { bucket: AgingBucket; amountMinor: number }[];
  monthly: { month: string; collectedMinor: number; newCreditMinor: number }[];
  topOverdue: CollectionRow[];
  upcoming: (CollectionRow & { dueDate: string })[];
}

/* ---------- reports ---------- */

export interface DateRange {
  from: string;
  to: string;
}

export interface Reports {
  collectionsByDay(range: DateRange): Promise<{ day: string; method: PaymentMethod; count: number; amountMinor: number }[]>;
  newCreditSales(range: DateRange): Promise<{ saleId: string; saleNumber: string; saleDate: string; customerName: string; totalMinor: number; remainingMinor: number; status: SaleRecord["status"] }[]>;
  agingByCustomer(): Promise<({ customerId: string; name: string; phone: string; totalMinor: number } & Record<AgingBucket, number>)[]>;
  outstandingByCategory(): Promise<{ categoryId: string | null; nameBn: string | null; nameEn: string | null; outstandingMinor: number }[]>;
  adjustments(range: DateRange): Promise<(AdjustmentView & { customerName: string })[]>;
}

export interface ActivityRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  at: Date;
}

export interface CategoryPick {
  id: string;
  parentId: string | null;
  nameBn: string | null;
  nameEn: string | null;
  archived: boolean;
}

/** Read side, implemented with SQL over the balance views. */
export interface Queries {
  listCustomers(input: { q?: string; filter: CustomerFilter; limit: number; offset: number }): Promise<{ items: CustomerListItem[]; total: number }>;
  customerProfile(id: string): Promise<CustomerProfile | null>;
  customerLedger(id: string, range?: DateRange): Promise<{ openingBalanceMinor: number; entries: LedgerEntry[] }>;
  customerFollowUps(id: string): Promise<FollowUpView[]>;
  customerBalance(id: string): Promise<number>;
  customerOpenInstallments(id: string): Promise<(InstallmentView & { saleId: string | null; saleNumber: string | null })[]>;
  customerAdjustments(id: string): Promise<AdjustmentView[]>;
  saleDetail(id: string): Promise<SaleDetail | null>;
  paymentDetail(id: string): Promise<PaymentDetail | null>;
  collections(): Promise<CollectionsView>;
  dashboard(): Promise<DashboardView>;
  reports: Reports;
  activity(input: { limit: number; before?: Date; entity?: string }): Promise<ActivityRow[]>;
  exportTable(table: string): Promise<{ columns: string[]; rows: Record<string, unknown>[] } | null>;
  exportableTables(): readonly string[];
}
