import type { OpenInstallment } from "@/domain/payment/payment";
import type {
  ActivityEntry,
  AdjustmentRecord,
  Category,
  CustomerRecord,
  FieldDefinition,
  FollowUpRecord,
  InstallmentRecord,
  Locale,
  PaymentRecord,
  SaleItemRecord,
  SaleRecord,
  SettingsRecord,
} from "./records";

export interface SettingsRepo {
  get(): Promise<SettingsRecord>;
  update(patch: Partial<SettingsRecord>): Promise<SettingsRecord>;
}

export interface SequenceRepo {
  /** Gap-free: increments inside the current transaction (rolled back with it). */
  next(kind: "sale" | "receipt"): Promise<number>;
}

export interface CatalogRepo {
  listCategories(): Promise<Category[]>;
  insertCategory(c: Omit<Category, "id">): Promise<Category>;
  updateCategory(id: string, patch: Partial<Omit<Category, "id">>): Promise<void>;
  listFields(): Promise<FieldDefinition[]>;
  insertField(f: Omit<FieldDefinition, "id">): Promise<FieldDefinition>;
  updateField(id: string, patch: Partial<Omit<FieldDefinition, "id" | "key" | "type">>): Promise<void>;
}

export interface CustomerRepo {
  getById(id: string): Promise<CustomerRecord | null>;
  findByPhone(e164: string): Promise<CustomerRecord | null>;
  insert(c: Omit<CustomerRecord, "id">): Promise<CustomerRecord>;
  update(id: string, patch: Partial<Omit<CustomerRecord, "id">>): Promise<void>;
}

export type NewSaleItem = Omit<SaleItemRecord, "id" | "saleId">;

export interface SaleRepo {
  getById(id: string): Promise<SaleRecord | null>;
  findByIdempotencyKey(key: string): Promise<SaleRecord | null>;
  insert(sale: Omit<SaleRecord, "id">, items: NewSaleItem[]): Promise<SaleRecord>;
  getItems(saleId: string): Promise<SaleItemRecord[]>;
  replaceItems(saleId: string, items: NewSaleItem[]): Promise<void>;
  update(id: string, patch: Partial<Omit<SaleRecord, "id" | "customerId" | "saleNumber">>): Promise<void>;
}

export interface LedgerRepo {
  /** Current balance across all open obligations (sales not cancelled + debit adjustments). */
  customerBalance(customerId: string): Promise<number>;
  /** Unpaid installments, optionally of one sale. `lock` = SELECT … FOR UPDATE in the tx. */
  openInstallments(customerId: string, opts: { saleId?: string | null; lock?: boolean }): Promise<OpenInstallment[]>;
  installmentsForSale(saleId: string): Promise<(InstallmentRecord & { paidMinor: number })[]>;
  insertInstallments(rows: Omit<InstallmentRecord, "id">[]): Promise<InstallmentRecord[]>;
  deleteInstallments(ids: string[]): Promise<void>;
  insertPayment(p: Omit<PaymentRecord, "id">): Promise<PaymentRecord>;
  getPayment(id: string): Promise<PaymentRecord | null>;
  findPaymentByIdempotencyKey(key: string): Promise<PaymentRecord | null>;
  /** Marks voided; the DB removes its allocations (trigger). */
  voidPayment(id: string, reason: string, at: Date): Promise<void>;
  insertAdjustment(a: Omit<AdjustmentRecord, "id" | "createdAt">): Promise<AdjustmentRecord>;
  insertAllocations(
    rows: { paymentId?: string; adjustmentId?: string; installmentId: string; amountMinor: number }[],
  ): Promise<void>;
  /** any = something applied; afterUpfront = something other than the upfront payment applied. */
  saleAllocationStats(saleId: string): Promise<{ any: boolean; afterUpfront: boolean }>;
  /** Sales touched by a payment's allocations (before voiding it). */
  salesOfPayment(paymentId: string): Promise<string[]>;
  salesOfInstallments(installmentIds: string[]): Promise<string[]>;
  /** open ↔ closed from balances; `writtenOff` marks fully settled ones as written_off. */
  refreshSaleStatuses(saleIds: string[], opts?: { writtenOff?: boolean }): Promise<void>;
}

export interface FollowUpRepo {
  insert(f: Omit<FollowUpRecord, "id" | "createdAt">): Promise<FollowUpRecord>;
}

export interface TranslationRepo {
  list(): Promise<{ locale: Locale; key: string; value: string }[]>;
  set(locale: Locale, key: string, value: string): Promise<void>;
  remove(locale: Locale, key: string): Promise<void>;
}

export interface ClearRange {
  /** inclusive YYYY-MM-DD, shop calendar (Asia/Dhaka) */
  from: string;
  to: string;
  removeEmptyCustomers: boolean;
}

export interface ClearCounts {
  sales: number;
  payments: number;
  adjustments: number;
  followUps: number;
  customers: number;
  photos: number;
  /** linked records dated OUTSIDE the range that must go too (e.g. a later payment on a deleted sale) */
  linkedPayments: number;
  linkedAdjustments: number;
}

export interface ClearPlan {
  range: ClearRange;
  saleIds: string[];
  paymentIds: string[];
  adjustmentIds: string[];
  installmentIds: string[];
  followUpIds: string[];
  customerIds: string[];
  photoKeys: string[];
  counts: ClearCounts;
}

/** Hard delete for the "clear data for a date range" action: the only place deletes are allowed. */
export interface DataEraser {
  plan(range: ClearRange): Promise<ClearPlan>;
  /** The rows the plan would delete, for a backup file. */
  snapshot(plan: ClearPlan): Promise<Record<string, unknown[]>>;
  erase(plan: ClearPlan): Promise<void>;
}

export interface ActivityLogRepo {
  log(entry: ActivityEntry): Promise<void>;
}

export interface Repos {
  settings: SettingsRepo;
  sequences: SequenceRepo;
  catalog: CatalogRepo;
  customers: CustomerRepo;
  sales: SaleRepo;
  ledger: LedgerRepo;
  followUps: FollowUpRepo;
  translations: TranslationRepo;
  activity: ActivityLogRepo;
  eraser: DataEraser;
}

/** Runs work in ONE database transaction (every money write goes through this). */
export interface UnitOfWork {
  run<T>(work: (repos: Repos) => Promise<T>): Promise<T>;
}
