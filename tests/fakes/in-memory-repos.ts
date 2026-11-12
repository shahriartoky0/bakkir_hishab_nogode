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
} from "@/application/ports/records";
import type { NewSaleItem, Repos, UnitOfWork } from "@/application/ports/repositories";
import type { OpenInstallment } from "@/domain/payment/payment";

interface AllocationRow {
  id: string;
  paymentId?: string;
  adjustmentId?: string;
  installmentId: string;
  amountMinor: number;
}

export const defaultSettings = (): SettingsRecord => ({
  shopNameBn: "সোনার দোকান",
  shopNameEn: "Gold Shop",
  addressBn: null,
  addressEn: null,
  phone: null,
  logoKey: null,
  receiptFooterBn: null,
  receiptFooterEn: null,
  defaultLocale: "bn",
  useBanglaDigits: true,
  defaultCreditDays: 30,
  salePrefix: "INV-",
  receiptPrefix: "RCP-",
  autoLogoutMinutes: 30,
  starterSetDecidedAt: null,
});

/**
 * In-memory implementation of every write-side repository, mirroring the DB
 * constraints the use cases rely on (no over-allocation, void removes allocations).
 * `run` snapshots state and restores it if the work throws, like a transaction.
 */
export class InMemoryStore implements UnitOfWork {
  private n = 0;
  settings = defaultSettings();
  seq = { sale: 1, receipt: 1 };
  categories: Category[] = [];
  fields: FieldDefinition[] = [];
  customers: CustomerRecord[] = [];
  sales: SaleRecord[] = [];
  items: SaleItemRecord[] = [];
  installments: InstallmentRecord[] = [];
  payments: PaymentRecord[] = [];
  adjustments: AdjustmentRecord[] = [];
  allocations: AllocationRow[] = [];
  followUps: FollowUpRecord[] = [];
  translations: { locale: Locale; key: string; value: string }[] = [];
  activity: ActivityEntry[] = [];
  /** Calls to the eraser fake (the real closure logic is covered by the integration test). */
  erased: { from: string; to: string }[] = [];

  id(prefix: string) {
    this.n += 1;
    return `${prefix}-${this.n}`;
  }

  paidOf(installmentId: string) {
    return this.allocations.filter((a) => a.installmentId === installmentId).reduce((s, a) => s + a.amountMinor, 0);
  }

  private liveInstallments(customerId: string) {
    return this.installments.filter((i) => {
      if (i.customerId !== customerId) return false;
      if (!i.saleId) return true;
      return this.sales.find((s) => s.id === i.saleId)?.status !== "cancelled";
    });
  }

  async run<T>(work: (repos: Repos) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.snapshotData());
    try {
      return await work(this.repos());
    } catch (e) {
      Object.assign(this, snapshot);
      throw e;
    }
  }

  private snapshotData() {
    const { settings, seq, categories, fields, customers, sales, items, installments, payments, adjustments, allocations, followUps, translations, activity } = this;
    return { settings, seq, categories, fields, customers, sales, items, installments, payments, adjustments, allocations, followUps, translations, activity };
  }

  repos(): Repos {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const s = this;
    return {
      settings: {
        get: async () => ({ ...s.settings }),
        update: async (patch) => (s.settings = { ...s.settings, ...patch }),
      },
      sequences: {
        next: async (kind) => s.seq[kind]++,
      },
      catalog: {
        listCategories: async () => s.categories.map((c) => ({ ...c })),
        insertCategory: async (c) => {
          const row = { ...c, id: s.id("cat") };
          s.categories.push(row);
          return row;
        },
        updateCategory: async (id, patch) => {
          s.categories = s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
        },
        listFields: async () => s.fields.map((f) => ({ ...f })),
        insertField: async (f) => {
          const row = { ...f, id: s.id("fld") };
          s.fields.push(row);
          return row;
        },
        updateField: async (id, patch) => {
          s.fields = s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f));
        },
      },
      customers: {
        getById: async (id) => s.customers.find((c) => c.id === id) ?? null,
        findByPhone: async (phone) => s.customers.find((c) => c.phone === phone) ?? null,
        insert: async (c) => {
          const row = { ...c, id: s.id("cus") };
          s.customers.push(row);
          return row;
        },
        update: async (id, patch) => {
          s.customers = s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c));
        },
      },
      sales: {
        getById: async (id) => s.sales.find((x) => x.id === id) ?? null,
        findByIdempotencyKey: async (key) => s.sales.find((x) => x.idempotencyKey === key) ?? null,
        insert: async (sale, items) => {
          const row = { ...sale, id: s.id("sale") };
          s.sales.push(row);
          s.items.push(...items.map((it: NewSaleItem) => ({ ...it, id: s.id("item"), saleId: row.id })));
          return row;
        },
        getItems: async (saleId) => s.items.filter((i) => i.saleId === saleId),
        replaceItems: async (saleId, items) => {
          s.items = s.items.filter((i) => i.saleId !== saleId);
          s.items.push(...items.map((it) => ({ ...it, id: s.id("item"), saleId })));
        },
        update: async (id, patch) => {
          s.sales = s.sales.map((x) => (x.id === id ? { ...x, ...patch } : x));
        },
      },
      ledger: {
        customerBalance: async (customerId) =>
          s.liveInstallments(customerId).reduce((sum, i) => sum + i.amountMinor - s.paidOf(i.id), 0),
        openInstallments: async (customerId, { saleId }) =>
          s
            .liveInstallments(customerId)
            .filter((i) => !saleId || i.saleId === saleId)
            .map((i): OpenInstallment => ({ id: i.id, saleId: i.saleId, dueDate: i.dueDate, seq: i.seq, remainingMinor: i.amountMinor - s.paidOf(i.id) }))
            .filter((i) => i.remainingMinor > 0),
        installmentsForSale: async (saleId) =>
          s.installments.filter((i) => i.saleId === saleId).map((i) => ({ ...i, paidMinor: s.paidOf(i.id) })),
        insertInstallments: async (rows) => {
          const out = rows.map((r) => ({ ...r, id: s.id("inst") }));
          s.installments.push(...out);
          return out;
        },
        deleteInstallments: async (ids) => {
          if (s.allocations.some((a) => ids.includes(a.installmentId))) throw new Error("FK: installment has allocations");
          s.installments = s.installments.filter((i) => !ids.includes(i.id));
        },
        insertPayment: async (p) => {
          const row = { ...p, id: s.id("pay") };
          s.payments.push(row);
          return row;
        },
        getPayment: async (id) => s.payments.find((p) => p.id === id) ?? null,
        findPaymentByIdempotencyKey: async (key) => s.payments.find((p) => p.idempotencyKey === key) ?? null,
        voidPayment: async (id, reason, at) => {
          s.payments = s.payments.map((p) => (p.id === id ? { ...p, status: "voided", voidReason: reason, voidedAt: at } : p));
          s.allocations = s.allocations.filter((a) => a.paymentId !== id); // DB trigger
        },
        insertAdjustment: async (a) => {
          const row = { ...a, id: s.id("adj"), createdAt: new Date() };
          s.adjustments.push(row);
          return row;
        },
        insertAllocations: async (rows) => {
          for (const r of rows) {
            // DB constraint triggers
            if ((r.paymentId ? 1 : 0) + (r.adjustmentId ? 1 : 0) !== 1) throw new Error("allocation needs exactly one source");
            const inst = s.installments.find((i) => i.id === r.installmentId);
            if (!inst) throw new Error("FK installment");
            if (s.paidOf(inst.id) + r.amountMinor > inst.amountMinor) throw new Error("over-allocation");
            if (r.paymentId) {
              const p = s.payments.find((x) => x.id === r.paymentId)!;
              const used = s.allocations.filter((a) => a.paymentId === p.id).reduce((x, a) => x + a.amountMinor, 0);
              if (p.status !== "active" || used + r.amountMinor > p.amountMinor) throw new Error("payment over-allocation");
            }
            s.allocations.push({ ...r, id: s.id("alloc") });
          }
        },
        saleAllocationStats: async (saleId) => {
          const instIds = new Set(s.installments.filter((i) => i.saleId === saleId).map((i) => i.id));
          const rows = s.allocations.filter((a) => instIds.has(a.installmentId));
          const afterUpfront = rows.some((a) => !a.paymentId || !s.payments.find((p) => p.id === a.paymentId)?.isUpfront);
          return { any: rows.length > 0, afterUpfront };
        },
        salesOfPayment: async (paymentId) => {
          const instIds = s.allocations.filter((a) => a.paymentId === paymentId).map((a) => a.installmentId);
          return [...new Set(s.installments.filter((i) => instIds.includes(i.id) && i.saleId).map((i) => i.saleId!))];
        },
        salesOfInstallments: async (ids) => [...new Set(s.installments.filter((i) => ids.includes(i.id) && i.saleId).map((i) => i.saleId!))],
        refreshSaleStatuses: async (saleIds, opts) => {
          s.sales = s.sales.map((sale) => {
            if (!saleIds.includes(sale.id) || sale.status === "cancelled") return sale;
            const remaining = s.installments
              .filter((i) => i.saleId === sale.id)
              .reduce((sum, i) => sum + i.amountMinor - s.paidOf(i.id), 0);
            if (remaining > 0) return { ...sale, status: "open" };
            if (opts?.writtenOff || sale.status === "written_off") return { ...sale, status: "written_off" };
            return { ...sale, status: "closed" };
          });
        },
      },
      followUps: {
        insert: async (f) => {
          const row = { ...f, id: s.id("fu"), createdAt: new Date() };
          s.followUps.push(row);
          return row;
        },
      },
      translations: {
        list: async () => [...s.translations],
        set: async (locale, key, value) => {
          s.translations = [...s.translations.filter((t) => !(t.locale === locale && t.key === key)), { locale, key, value }];
        },
        remove: async (locale, key) => {
          s.translations = s.translations.filter((t) => !(t.locale === locale && t.key === key));
        },
      },
      activity: {
        log: async (e) => {
          s.activity.push(e);
        },
      },
      eraser: {
        plan: async (range) => ({
          range,
          saleIds: [],
          paymentIds: [],
          adjustmentIds: [],
          installmentIds: [],
          followUpIds: [],
          customerIds: [],
          photoKeys: ["item/x.jpg"],
          counts: { sales: 0, payments: 0, adjustments: 0, followUps: 0, customers: 0, photos: 1, linkedPayments: 0, linkedAdjustments: 0 },
        }),
        snapshot: async () => ({}),
        erase: async (plan) => {
          s.erased.push({ from: plan.range.from, to: plan.range.to });
        },
      },
    };
  }

  balance(customerId: string) {
    return this.liveInstallments(customerId).reduce((sum, i) => sum + i.amountMinor - this.paidOf(i.id), 0);
  }
}
