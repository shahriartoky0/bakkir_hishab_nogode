import { applicableFields, validateCustomFields } from "@/domain/catalog/field-definition";
import { creditWarnings } from "@/domain/customer/credit";
import { PAYMENT_METHODS, type PaymentMethod } from "@/domain/payment/payment";
import { scheduleWithUpfront, buildSchedule, type RepaymentPlan } from "@/domain/sale/installment-plan";
import { canCancelSale, canEditSale, computeSaleTotals, type ItemPhoto, type SaleItemDraft } from "@/domain/sale/sale";
import {
  domainError,
  DomainErrorCode,
  err,
  ok,
  ShopDate,
  type DomainError,
  type Result,
} from "@/domain/shared";
import type { Clock } from "../../ports/clock";
import type { Repos, NewSaleItem, UnitOfWork } from "../../ports/repositories";
import { formatDocNumber, todayIn } from "../shared";

export interface SaleItemInput {
  categoryId: string | null;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  /** Raw form values; validated against the category's field definitions. */
  customFields: Record<string, unknown>;
  notes?: string | null;
  photos: ItemPhoto[];
}

export interface CreateSaleInput {
  idempotencyKey: string;
  customerId: string;
  saleDate?: string;
  items: SaleItemInput[];
  discountMinor: number;
  upfront?: { amountMinor: number; method: PaymentMethod; reference?: string | null } | null;
  plan: RepaymentPlan;
  notes?: string | null;
  /** The owner confirmed "continue anyway" on credit-limit / blocked warnings. */
  confirmWarnings?: boolean;
}

type Deps = { uow: UnitOfWork; clock: Clock };

/** Validate items + their category custom fields (spec 6.1: validated again in the domain). */
async function prepareItems(r: Repos, items: SaleItemInput[]): Promise<Result<SaleItemDraft[], DomainError>> {
  const [categories, fields] = await Promise.all([r.catalog.listCategories(), r.catalog.listFields()]);
  const drafts: SaleItemDraft[] = [];
  for (const [index, item] of items.entries()) {
    if (item.categoryId) {
      const cat = categories.find((c) => c.id === item.categoryId);
      if (!cat) return err(domainError(DomainErrorCode.NOT_FOUND, { item: index }));
    }
    const defs = applicableFields(item.categoryId, categories, fields);
    const custom = validateCustomFields(defs, item.customFields ?? {});
    if (!custom.ok) return err(domainError(custom.error.code, { ...custom.error.details, item: index }));
    drafts.push({
      categoryId: item.categoryId,
      name: item.name.trim().slice(0, 200),
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      customFields: custom.value,
      notes: item.notes?.trim() || null,
      photos: item.photos,
    });
  }
  return ok(drafts);
}

function toNewItems(drafts: SaleItemDraft[], lineTotals: number[]): NewSaleItem[] {
  return drafts.map((d, i) => ({
    categoryId: d.categoryId,
    name: d.name,
    quantity: d.quantity,
    unitPriceMinor: d.unitPriceMinor,
    lineTotalMinor: lineTotals[i]!,
    customFields: d.customFields,
    notes: d.notes,
    sortOrder: i,
    photos: d.photos.map((p, j) => ({ ...p, sortOrder: j })),
  }));
}

export class CreateSale {
  constructor(private readonly deps: Deps) {}

  execute(input: CreateSaleInput): Promise<Result<{ saleId: string; created: boolean }, DomainError>> {
    return this.deps.uow.run(async (r) => {
      // Double-tap safe: the same key returns the sale already created.
      const existing = await r.sales.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return ok({ saleId: existing.id, created: false });

      const customer = await r.customers.getById(input.customerId);
      if (!customer) return err(domainError(DomainErrorCode.NOT_FOUND));
      if (customer.archivedAt) return err(domainError(DomainErrorCode.CUSTOMER_ARCHIVED));

      const today = todayIn(this.deps.clock);
      const saleDateR = input.saleDate ? ShopDate.parse(input.saleDate) : ok(today);
      if (!saleDateR.ok || saleDateR.value.isAfter(today)) return err(domainError(DomainErrorCode.INVALID_DATE));
      const saleDate = saleDateR.value;

      const drafts = await prepareItems(r, input.items);
      if (!drafts.ok) return drafts;
      const totals = computeSaleTotals(drafts.value, input.discountMinor);
      if (!totals.ok) return totals;

      const upfrontMinor = input.upfront?.amountMinor ?? 0;
      if (upfrontMinor > 0 && !PAYMENT_METHODS.includes(input.upfront!.method)) return err(domainError(DomainErrorCode.VALIDATION));
      const schedule = scheduleWithUpfront(totals.value.totalMinor, upfrontMinor, input.plan, saleDate);
      if (!schedule.ok) return schedule;

      if (!input.confirmWarnings) {
        const balance = await r.ledger.customerBalance(customer.id);
        const warnings = creditWarnings({
          isBlocked: customer.isBlocked,
          creditLimitMinor: customer.creditLimitMinor,
          currentBalanceMinor: balance,
          newCreditMinor: totals.value.totalMinor - upfrontMinor,
        });
        if (warnings.length) {
          return err(domainError(DomainErrorCode.CREDIT_WARNING, { blocked: warnings.includes("BLOCKED"), overLimit: warnings.includes("OVER_LIMIT") }));
        }
      }

      const settings = await r.settings.get();
      const saleNumber = formatDocNumber(settings.salePrefix, await r.sequences.next("sale"));
      const sale = await r.sales.insert(
        {
          customerId: customer.id,
          saleNumber,
          saleDate: saleDate.iso,
          subtotalMinor: totals.value.subtotalMinor,
          discountMinor: totals.value.discountMinor,
          totalMinor: totals.value.totalMinor,
          status: "open",
          notes: input.notes?.trim() || null,
          idempotencyKey: input.idempotencyKey,
          cancelReason: null,
        },
        toNewItems(drafts.value, totals.value.lineTotals),
      );
      const installments = await r.ledger.insertInstallments(
        schedule.value.map((s) => ({ ...s, customerId: customer.id, saleId: sale.id, adjustmentId: null })),
      );

      let paymentId: string | null = null;
      if (upfrontMinor > 0) {
        const receiptNumber = formatDocNumber(settings.receiptPrefix, await r.sequences.next("receipt"));
        const payment = await r.ledger.insertPayment({
          customerId: customer.id,
          saleId: sale.id,
          receiptNumber,
          amountMinor: upfrontMinor,
          method: input.upfront!.method,
          reference: input.upfront!.reference?.trim() || null,
          paidAt: this.deps.clock.now(),
          note: null,
          status: "active",
          voidReason: null,
          voidedAt: null,
          idempotencyKey: null,
          isUpfront: true,
        });
        paymentId = payment.id;
        const upfrontInst = installments.find((i) => i.seq === 0)!;
        await r.ledger.insertAllocations([{ paymentId: payment.id, installmentId: upfrontInst.id, amountMinor: upfrontMinor }]);
      }

      await r.ledger.refreshSaleStatuses([sale.id]);
      await r.activity.log({
        action: "sale.created",
        entity: "sale",
        entityId: sale.id,
        summary: saleNumber,
        after: { ...sale, items: drafts.value.length, installments: schedule.value, upfrontMinor, upfrontPaymentId: paymentId },
      });
      return ok({ saleId: sale.id, created: true });
    });
  }
}

export interface UpdateSaleInput {
  saleId: string;
  items: SaleItemInput[];
  discountMinor: number;
  plan: RepaymentPlan;
  notes?: string | null;
}

/** Edit items/discount/schedule while no payment besides the upfront one is applied. */
export class UpdateSale {
  constructor(private readonly deps: Deps) {}

  execute(input: UpdateSaleInput): Promise<Result<null, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const sale = await r.sales.getById(input.saleId);
      if (!sale) return err(domainError(DomainErrorCode.NOT_FOUND));
      const stats = await r.ledger.saleAllocationStats(sale.id);
      if (!canEditSale(sale, stats.afterUpfront)) return err(domainError(DomainErrorCode.SALE_NOT_EDITABLE));

      const drafts = await prepareItems(r, input.items);
      if (!drafts.ok) return drafts;
      const totals = computeSaleTotals(drafts.value, input.discountMinor);
      if (!totals.ok) return totals;

      const installments = await r.ledger.installmentsForSale(sale.id);
      const upfront = installments.find((i) => i.seq === 0);
      const upfrontMinor = upfront?.amountMinor ?? 0;
      if (upfrontMinor > totals.value.totalMinor) return err(domainError(DomainErrorCode.UPFRONT_TOO_LARGE));
      const schedule = buildSchedule(totals.value.totalMinor - upfrontMinor, input.plan, ShopDate.of(sale.saleDate));
      if (!schedule.ok) return schedule;

      const beforeItems = await r.sales.getItems(sale.id);
      await r.sales.replaceItems(sale.id, toNewItems(drafts.value, totals.value.lineTotals));
      await r.ledger.deleteInstallments(installments.filter((i) => i.seq !== 0).map((i) => i.id));
      await r.ledger.insertInstallments(
        schedule.value.map((s) => ({ ...s, customerId: sale.customerId, saleId: sale.id, adjustmentId: null })),
      );
      const patch = {
        subtotalMinor: totals.value.subtotalMinor,
        discountMinor: totals.value.discountMinor,
        totalMinor: totals.value.totalMinor,
        notes: input.notes?.trim() || null,
      };
      await r.sales.update(sale.id, patch);
      await r.ledger.refreshSaleStatuses([sale.id]);
      await r.activity.log({
        action: "sale.updated",
        entity: "sale",
        entityId: sale.id,
        summary: sale.saleNumber,
        before: { ...sale, items: beforeItems, installments },
        after: { ...sale, ...patch, items: drafts.value, installments: schedule.value },
      });
      return ok(null);
    });
  }
}

export class CancelSale {
  constructor(private readonly deps: Deps) {}

  execute(input: { saleId: string; reason: string }): Promise<Result<null, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const sale = await r.sales.getById(input.saleId);
      if (!sale) return err(domainError(DomainErrorCode.NOT_FOUND));
      const reason = input.reason?.trim();
      if (!reason || reason.length < 3) return err(domainError(DomainErrorCode.REASON_REQUIRED));
      const stats = await r.ledger.saleAllocationStats(sale.id);
      if (!canCancelSale(sale, stats.any)) return err(domainError(DomainErrorCode.SALE_HAS_PAYMENTS));
      await r.sales.update(sale.id, { status: "cancelled", cancelReason: reason.slice(0, 500) });
      await r.activity.log({ action: "sale.cancelled", entity: "sale", entityId: sale.id, summary: sale.saleNumber, before: sale, after: { ...sale, status: "cancelled", cancelReason: reason } });
      return ok(null);
    });
  }
}
