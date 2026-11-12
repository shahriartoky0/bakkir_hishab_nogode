import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type {
  ActivityEntry,
  AdjustmentRecord,
  Category,
  CustomerRecord,
  FieldDefinition,
  InstallmentRecord,
  Locale,
  PaymentRecord,
  SaleItemRecord,
  SaleRecord,
  SettingsRecord,
} from "@/application/ports/records";
import type { NewSaleItem, Repos, UnitOfWork } from "@/application/ports/repositories";
import type { FieldType } from "@/domain/catalog/field-definition";
import type { AdjustmentType, Direction, OpenInstallment, PaymentMethod } from "@/domain/payment/payment";
import type { SaleStatus } from "@/domain/sale/sale";
import type { Database } from "../db/client";
import { makeEraser } from "./drizzle-eraser";
import {
  activityLog,
  adjustments,
  allocations,
  categories,
  customers,
  fieldDefinitions,
  followUps as followUpsTable,
  installments,
  payments,
  saleItemPhotos,
  saleItems,
  sales,
  sequences,
  settings,
  translationOverrides,
} from "../db/schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Tx;

const idList = (ids: string[]): SQL => sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);

/* ---------- row mappers ---------- */

type SettingsRow = typeof settings.$inferSelect;
export function toSettings(r: SettingsRow): SettingsRecord {
  return {
    shopNameBn: r.shopNameBn,
    shopNameEn: r.shopNameEn,
    addressBn: r.addressBn,
    addressEn: r.addressEn,
    phone: r.phone,
    logoKey: r.logoKey,
    receiptFooterBn: r.receiptFooterBn,
    receiptFooterEn: r.receiptFooterEn,
    defaultLocale: (r.defaultLocale === "en" ? "en" : "bn") as Locale,
    useBanglaDigits: r.useBanglaDigits,
    defaultCreditDays: r.defaultCreditDays,
    salePrefix: r.salePrefix,
    receiptPrefix: r.receiptPrefix,
    autoLogoutMinutes: r.autoLogoutMinutes,
    starterSetDecidedAt: r.starterSetDecidedAt,
  };
}

const toCategory = (r: typeof categories.$inferSelect): Category => ({
  id: r.id,
  parentId: r.parentId,
  nameBn: r.nameBn,
  nameEn: r.nameEn,
  sortOrder: r.sortOrder,
  archivedAt: r.archivedAt,
});

const toField = (r: typeof fieldDefinitions.$inferSelect): FieldDefinition => ({
  id: r.id,
  categoryId: r.categoryId,
  key: r.key,
  labelBn: r.labelBn,
  labelEn: r.labelEn,
  type: r.type as FieldType,
  options: r.options,
  unitBn: r.unitBn,
  unitEn: r.unitEn,
  isRequired: r.isRequired,
  showOnReceipt: r.showOnReceipt,
  sortOrder: r.sortOrder,
  archivedAt: r.archivedAt,
});

export const toCustomer = (r: typeof customers.$inferSelect): CustomerRecord => ({
  id: r.id,
  name: r.name,
  nameBn: r.nameBn,
  phone: r.phone,
  altPhone: r.altPhone,
  address: r.address,
  photoKey: r.photoKey,
  photoThumbKey: r.photoThumbKey,
  nidNumber: r.nidNumber,
  guarantorName: r.guarantorName,
  guarantorPhone: r.guarantorPhone,
  guarantorRelation: r.guarantorRelation,
  creditLimitMinor: r.creditLimitMinor,
  isBlocked: r.isBlocked,
  notes: r.notes,
  archivedAt: r.archivedAt,
});

export const toSale = (r: typeof sales.$inferSelect): SaleRecord => ({
  id: r.id,
  customerId: r.customerId,
  saleNumber: r.saleNumber,
  saleDate: r.saleDate,
  subtotalMinor: r.subtotalMinor,
  discountMinor: r.discountMinor,
  totalMinor: r.totalMinor,
  status: r.status as SaleStatus,
  notes: r.notes,
  idempotencyKey: r.idempotencyKey,
  cancelReason: r.cancelReason,
});

export const toPayment = (r: typeof payments.$inferSelect): PaymentRecord => ({
  id: r.id,
  customerId: r.customerId,
  saleId: r.saleId,
  receiptNumber: r.receiptNumber,
  amountMinor: r.amountMinor,
  method: r.method as PaymentMethod,
  reference: r.reference,
  paidAt: r.paidAt,
  note: r.note,
  status: r.status === "voided" ? "voided" : "active",
  voidReason: r.voidReason,
  voidedAt: r.voidedAt,
  idempotencyKey: r.idempotencyKey,
  isUpfront: r.isUpfront,
});

export const toAdjustment = (r: typeof adjustments.$inferSelect): AdjustmentRecord => ({
  id: r.id,
  customerId: r.customerId,
  saleId: r.saleId,
  type: r.type as AdjustmentType,
  direction: r.direction as Direction,
  amountMinor: r.amountMinor,
  reason: r.reason,
  createdAt: r.createdAt,
});

const toInstallment = (r: typeof installments.$inferSelect): InstallmentRecord => ({
  id: r.id,
  customerId: r.customerId,
  saleId: r.saleId,
  adjustmentId: r.adjustmentId,
  seq: r.seq,
  dueDate: r.dueDate,
  amountMinor: r.amountMinor,
});

/** Items of the given sales with their photos, ordered. */
export async function loadItems(db: Executor, saleIds: string[]): Promise<SaleItemRecord[]> {
  if (saleIds.length === 0) return [];
  const rows = await db.select().from(saleItems).where(inArray(saleItems.saleId, saleIds)).orderBy(asc(saleItems.sortOrder));
  const photos = rows.length
    ? await db
        .select()
        .from(saleItemPhotos)
        .where(inArray(saleItemPhotos.saleItemId, rows.map((r) => r.id)))
        .orderBy(asc(saleItemPhotos.sortOrder))
    : [];
  return rows.map((r) => ({
    id: r.id,
    saleId: r.saleId,
    categoryId: r.categoryId,
    name: r.name,
    quantity: r.quantity,
    unitPriceMinor: r.unitPriceMinor,
    lineTotalMinor: r.lineTotalMinor,
    customFields: r.customFields,
    notes: r.notes,
    sortOrder: r.sortOrder,
    photos: photos
      .filter((p) => p.saleItemId === r.id)
      .map((p) => ({ fileKey: p.fileKey, thumbKey: p.thumbKey, sortOrder: p.sortOrder })),
  }));
}

async function insertItems(db: Executor, saleId: string, items: NewSaleItem[]) {
  for (const it of items) {
    const [row] = await db
      .insert(saleItems)
      .values({
        saleId,
        categoryId: it.categoryId,
        name: it.name,
        quantity: it.quantity,
        unitPriceMinor: it.unitPriceMinor,
        lineTotalMinor: it.lineTotalMinor,
        customFields: it.customFields,
        notes: it.notes,
        sortOrder: it.sortOrder,
      })
      .returning({ id: saleItems.id });
    if (it.photos.length) {
      await db.insert(saleItemPhotos).values(it.photos.map((p) => ({ saleItemId: row!.id, ...p })));
    }
  }
}

/** All write-side repositories bound to one executor (the db or a transaction). */
export function makeRepos(db: Executor): Repos {
  return {
    settings: {
      async get() {
        const [row] = await db.select().from(settings).limit(1);
        if (row) return toSettings(row);
        const [created] = await db.insert(settings).values({ singleton: true }).onConflictDoNothing().returning();
        return toSettings(created ?? (await db.select().from(settings).limit(1))[0]!);
      },
      async update(patch) {
        await this.get();
        const [row] = await db.update(settings).set(patch).where(eq(settings.singleton, true)).returning();
        return toSettings(row!);
      },
    },

    sequences: {
      async next(kind) {
        const res = await db
          .update(sequences)
          .set({ nextValue: sql`${sequences.nextValue} + 1` })
          .where(eq(sequences.kind, kind))
          .returning({ n: sequences.nextValue });
        if (res[0]) return res[0].n - 1;
        await db.insert(sequences).values({ kind, nextValue: 2 }).onConflictDoNothing();
        return 1;
      },
    },

    catalog: {
      listCategories: async () => (await db.select().from(categories)).map(toCategory),
      insertCategory: async (c) => toCategory((await db.insert(categories).values(c).returning())[0]!),
      updateCategory: async (id, patch) => {
        await db.update(categories).set(patch).where(eq(categories.id, id));
      },
      listFields: async () => (await db.select().from(fieldDefinitions)).map(toField),
      insertField: async (f) => toField((await db.insert(fieldDefinitions).values(f).returning())[0]!),
      updateField: async (id, patch) => {
        await db.update(fieldDefinitions).set(patch).where(eq(fieldDefinitions.id, id));
      },
    },

    customers: {
      getById: async (id) => {
        const [r] = await db.select().from(customers).where(eq(customers.id, id));
        return r ? toCustomer(r) : null;
      },
      findByPhone: async (phone) => {
        const [r] = await db.select().from(customers).where(eq(customers.phone, phone));
        return r ? toCustomer(r) : null;
      },
      insert: async (c) => toCustomer((await db.insert(customers).values(c).returning())[0]!),
      update: async (id, patch) => {
        await db.update(customers).set(patch).where(eq(customers.id, id));
      },
    },

    sales: {
      getById: async (id) => {
        const [r] = await db.select().from(sales).where(eq(sales.id, id));
        return r ? toSale(r) : null;
      },
      findByIdempotencyKey: async (key) => {
        const [r] = await db.select().from(sales).where(eq(sales.idempotencyKey, key));
        return r ? toSale(r) : null;
      },
      insert: async (sale, items) => {
        const [row] = await db.insert(sales).values(sale).returning();
        await insertItems(db, row!.id, items);
        return toSale(row!);
      },
      getItems: (saleId) => loadItems(db, [saleId]),
      replaceItems: async (saleId, items) => {
        await db.delete(saleItems).where(eq(saleItems.saleId, saleId)); // photos cascade
        await insertItems(db, saleId, items);
      },
      update: async (id, patch) => {
        await db.update(sales).set(patch).where(eq(sales.id, id));
      },
    },

    ledger: {
      async customerBalance(customerId) {
        const res = await db.execute<{ balance: string | number }>(
          sql`select balance_minor as balance from customer_balances where customer_id = ${customerId}`,
        );
        return Number(res.rows[0]?.balance ?? 0);
      },
      async openInstallments(customerId, { saleId, lock }) {
        const saleFilter = saleId ? sql`and i.sale_id = ${saleId}` : sql``;
        if (lock) {
          await db.execute(sql`select i.id from installments i where i.customer_id = ${customerId} ${saleFilter} for update`);
        }
        const res = await db.execute<{ id: string; sale_id: string | null; due_date: string; seq: number; remaining_minor: string }>(
          sql`select i.id, i.sale_id, i.due_date::text as due_date, i.seq, i.remaining_minor
              from installment_balances i
              where i.customer_id = ${customerId} ${saleFilter} and i.remaining_minor > 0`,
        );
        return res.rows.map(
          (r): OpenInstallment => ({ id: r.id, saleId: r.sale_id, dueDate: r.due_date, seq: Number(r.seq), remainingMinor: Number(r.remaining_minor) }),
        );
      },
      async installmentsForSale(saleId) {
        const rows = await db.select().from(installments).where(eq(installments.saleId, saleId)).orderBy(asc(installments.seq));
        if (!rows.length) return [];
        const paid = await db
          .select({ id: allocations.installmentId, paid: sql<string>`sum(${allocations.amountMinor})` })
          .from(allocations)
          .where(inArray(allocations.installmentId, rows.map((r) => r.id)))
          .groupBy(allocations.installmentId);
        return rows.map((r) => ({ ...toInstallment(r), paidMinor: Number(paid.find((p) => p.id === r.id)?.paid ?? 0) }));
      },
      async insertInstallments(rows) {
        if (!rows.length) return [];
        return (await db.insert(installments).values(rows).returning()).map(toInstallment);
      },
      async deleteInstallments(ids) {
        if (ids.length) await db.delete(installments).where(inArray(installments.id, ids));
      },
      insertPayment: async (p) => toPayment((await db.insert(payments).values(p).returning())[0]!),
      getPayment: async (id) => {
        const [r] = await db.select().from(payments).where(eq(payments.id, id));
        return r ? toPayment(r) : null;
      },
      findPaymentByIdempotencyKey: async (key) => {
        const [r] = await db.select().from(payments).where(eq(payments.idempotencyKey, key));
        return r ? toPayment(r) : null;
      },
      voidPayment: async (id, reason, at) => {
        await db.update(payments).set({ status: "voided", voidReason: reason, voidedAt: at }).where(eq(payments.id, id));
      },
      insertAdjustment: async (a) => toAdjustment((await db.insert(adjustments).values(a).returning())[0]!),
      async insertAllocations(rows) {
        if (!rows.length) return;
        await db.insert(allocations).values(
          rows.map((r) => ({ paymentId: r.paymentId ?? null, adjustmentId: r.adjustmentId ?? null, installmentId: r.installmentId, amountMinor: r.amountMinor })),
        );
      },
      async saleAllocationStats(saleId) {
        const res = await db.execute<{ any_alloc: boolean; after_upfront: boolean }>(sql`
          select
            exists(select 1 from allocations a join installments i on i.id = a.installment_id where i.sale_id = ${saleId}) as any_alloc,
            exists(
              select 1 from allocations a
              join installments i on i.id = a.installment_id
              left join payments p on p.id = a.payment_id
              where i.sale_id = ${saleId} and (a.payment_id is null or not p.is_upfront)
            ) as after_upfront`);
        const r = res.rows[0];
        return { any: Boolean(r?.any_alloc), afterUpfront: Boolean(r?.after_upfront) };
      },
      async salesOfPayment(paymentId) {
        const res = await db.execute<{ sale_id: string }>(sql`
          select distinct i.sale_id from allocations a join installments i on i.id = a.installment_id
          where a.payment_id = ${paymentId} and i.sale_id is not null`);
        return res.rows.map((r) => r.sale_id);
      },
      async salesOfInstallments(ids) {
        if (!ids.length) return [];
        const rows = await db
          .selectDistinct({ saleId: installments.saleId })
          .from(installments)
          .where(and(inArray(installments.id, ids), sql`${installments.saleId} is not null`));
        return rows.map((r) => r.saleId!);
      },
      async refreshSaleStatuses(saleIds, opts) {
        if (!saleIds.length) return;
        const writtenOff = Boolean(opts?.writtenOff);
        await db.execute(sql`
          update sales s set
            status = case
              when sb.remaining_minor > 0 then 'open'
              when ${writtenOff} or s.status = 'written_off' then 'written_off'
              else 'closed'
            end,
            updated_at = now()
          from sale_balances sb
          where sb.sale_id = s.id and s.id in (${idList(saleIds)}) and s.status <> 'cancelled'`);
      },
    },

    followUps: {
      insert: async (f) => {
        const [r] = await db.insert(followUpsTable).values(f).returning();
        return {
          id: r!.id,
          customerId: r!.customerId,
          saleId: r!.saleId,
          channel: r!.channel as never,
          outcome: r!.outcome as never,
          note: r!.note,
          promisedAmountMinor: r!.promisedAmountMinor,
          promisedDate: r!.promisedDate,
          createdAt: r!.createdAt,
        };
      },
    },

    translations: {
      list: async () =>
        (await db.select().from(translationOverrides)).map((r) => ({ locale: r.locale as Locale, key: r.key, value: r.value })),
      set: async (locale, key, value) => {
        await db
          .insert(translationOverrides)
          .values({ locale, key, value })
          .onConflictDoUpdate({ target: [translationOverrides.locale, translationOverrides.key], set: { value, updatedAt: new Date() } });
      },
      remove: async (locale, key) => {
        await db.delete(translationOverrides).where(and(eq(translationOverrides.locale, locale), eq(translationOverrides.key, key)));
      },
    },

    activity: {
      log: async (e: ActivityEntry) => {
        await db.insert(activityLog).values({
          action: e.action,
          entity: e.entity,
          entityId: e.entityId,
          summary: e.summary.slice(0, 300),
          before: e.before === undefined ? null : JSON.parse(JSON.stringify(e.before)),
          after: e.after === undefined ? null : JSON.parse(JSON.stringify(e.after)),
        });
      },
    },

    eraser: makeEraser(db),
  };
}

const isErrResult = (v: unknown) => typeof v === "object" && v !== null && "ok" in v && (v as { ok: unknown }).ok === false;

/** Every use case's work runs in one real Postgres transaction (Neon WebSocket pool). */
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  async run<T>(work: (repos: Repos) => Promise<T>): Promise<T> {
    let result: T | undefined;
    let rolledBack = false;
    try {
      return await this.db.transaction(async (tx) => {
        result = await work(makeRepos(tx));
        // Expected failures (Result err) must not leave partial writes behind.
        if (isErrResult(result)) {
          rolledBack = true;
          tx.rollback();
        }
        return result;
      });
    } catch (e) {
      if (rolledBack) return result as T;
      throw e;
    }
  }
}
