import {
  allocateOldestFirst,
  directionFor,
  PAYMENT_METHODS,
  validateCreditAmount,
  validateReason,
  type AdjustmentType,
  type Direction,
  type PaymentMethod,
} from "@/domain/payment/payment";
import { domainError, DomainErrorCode, err, ok, ShopDate, type DomainError, type Result } from "@/domain/shared";
import type { Clock } from "../../ports/clock";
import type { UnitOfWork } from "../../ports/repositories";
import { formatDocNumber, paidAtFromDate, todayIn } from "../shared";

type Deps = { uow: UnitOfWork; clock: Clock };

export interface ReceivePaymentInput {
  idempotencyKey: string;
  customerId: string;
  amountMinor: number;
  method: PaymentMethod;
  reference?: string | null;
  /** YYYY-MM-DD (default today) */
  date?: string | null;
  note?: string | null;
  /** Apply to one sale only; default = oldest due first across all sales. */
  saleId?: string | null;
}

export class ReceivePayment {
  constructor(private readonly deps: Deps) {}

  execute(input: ReceivePaymentInput): Promise<Result<{ paymentId: string; created: boolean }, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const existing = await r.ledger.findPaymentByIdempotencyKey(input.idempotencyKey);
      if (existing) return ok({ paymentId: existing.id, created: false });

      const customer = await r.customers.getById(input.customerId);
      if (!customer) return err(domainError(DomainErrorCode.NOT_FOUND));
      if (!PAYMENT_METHODS.includes(input.method)) return err(domainError(DomainErrorCode.VALIDATION));
      if (input.saleId) {
        const sale = await r.sales.getById(input.saleId);
        if (!sale || sale.customerId !== customer.id) return err(domainError(DomainErrorCode.NOT_FOUND));
      }
      const paidAt = paidAtFromDate(input.date, this.deps.clock);
      if (!paidAt.ok) return paidAt;

      // Lock the open installments so two payments can't race for the same balance.
      const open = await r.ledger.openInstallments(customer.id, { saleId: input.saleId ?? null, lock: true });
      const owed = open.reduce((s, i) => s + i.remainingMinor, 0);
      const valid = validateCreditAmount(input.amountMinor, owed);
      if (!valid.ok) return valid;

      const { allocations } = allocateOldestFirst(input.amountMinor, open);
      const settings = await r.settings.get();
      const receiptNumber = formatDocNumber(settings.receiptPrefix, await r.sequences.next("receipt"));
      const payment = await r.ledger.insertPayment({
        customerId: customer.id,
        saleId: input.saleId ?? null,
        receiptNumber,
        amountMinor: input.amountMinor,
        method: input.method,
        reference: input.reference?.trim() || null,
        paidAt: paidAt.value,
        note: input.note?.trim() || null,
        status: "active",
        voidReason: null,
        voidedAt: null,
        idempotencyKey: input.idempotencyKey,
        isUpfront: false,
      });
      await r.ledger.insertAllocations(allocations.map((a) => ({ ...a, paymentId: payment.id })));
      await r.ledger.refreshSaleStatuses(await r.ledger.salesOfInstallments(allocations.map((a) => a.installmentId)));
      await r.activity.log({
        action: "payment.received",
        entity: "payment",
        entityId: payment.id,
        summary: receiptNumber,
        after: { ...payment, allocations },
      });
      return ok({ paymentId: payment.id, created: true });
    });
  }
}

export class VoidPayment {
  constructor(private readonly deps: Deps) {}

  execute(input: { paymentId: string; reason: string }): Promise<Result<null, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const payment = await r.ledger.getPayment(input.paymentId);
      if (!payment) return err(domainError(DomainErrorCode.NOT_FOUND));
      if (payment.status === "voided") return err(domainError(DomainErrorCode.ALREADY_VOIDED));
      const reason = validateReason(input.reason);
      if (!reason.ok) return reason;

      const saleIds = await r.ledger.salesOfPayment(payment.id);
      const at = this.deps.clock.now();
      await r.ledger.voidPayment(payment.id, reason.value, at);
      await r.ledger.refreshSaleStatuses(saleIds);
      await r.activity.log({
        action: "payment.voided",
        entity: "payment",
        entityId: payment.id,
        summary: payment.receiptNumber,
        before: payment,
        after: { ...payment, status: "voided", voidReason: reason.value, voidedAt: at },
      });
      return ok(null);
    });
  }
}

export interface CreateAdjustmentInput {
  customerId: string;
  saleId?: string | null;
  type: AdjustmentType;
  /** Only used for `correction` (others have a fixed direction). */
  direction?: Direction;
  amountMinor: number;
  reason: string;
  /** For debit adjustments (opening balance / correction): when it is due. Default today. */
  dueDate?: string | null;
}

/**
 * Debits (opening balance, correction+) create an obligation (an installment
 * tied to the adjustment). Credits (return, discount, write-off, correction−)
 * are allocated oldest-first like a payment, so allocations stay the single
 * source of truth for what is settled.
 */
export class CreateAdjustment {
  constructor(private readonly deps: Deps) {}

  execute(input: CreateAdjustmentInput): Promise<Result<{ adjustmentId: string }, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const customer = await r.customers.getById(input.customerId);
      if (!customer) return err(domainError(DomainErrorCode.NOT_FOUND));
      if (input.saleId) {
        const sale = await r.sales.getById(input.saleId);
        if (!sale || sale.customerId !== customer.id) return err(domainError(DomainErrorCode.NOT_FOUND));
      }
      const reason = validateReason(input.reason);
      if (!reason.ok) return reason;
      if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
        return err(domainError(DomainErrorCode.INVALID_AMOUNT));
      }
      const direction = directionFor(input.type, input.direction);

      if (direction === "debit") {
        const today = todayIn(this.deps.clock);
        const due = input.dueDate ? ShopDate.parse(input.dueDate) : ok(today);
        if (!due.ok) return err(domainError(DomainErrorCode.INVALID_DATE));
        const adj = await r.ledger.insertAdjustment({
          customerId: customer.id,
          saleId: input.saleId ?? null,
          type: input.type,
          direction,
          amountMinor: input.amountMinor,
          reason: reason.value,
        });
        await r.ledger.insertInstallments([
          { customerId: customer.id, saleId: null, adjustmentId: adj.id, seq: 1, dueDate: due.value.iso, amountMinor: input.amountMinor },
        ]);
        await r.activity.log({ action: `adjustment.${input.type}`, entity: "adjustment", entityId: adj.id, summary: customer.name, after: adj });
        return ok({ adjustmentId: adj.id });
      }

      const open = await r.ledger.openInstallments(customer.id, { saleId: input.saleId ?? null, lock: true });
      const owed = open.reduce((s, i) => s + i.remainingMinor, 0);
      const valid = validateCreditAmount(input.amountMinor, owed);
      if (!valid.ok) return valid;

      const adj = await r.ledger.insertAdjustment({
        customerId: customer.id,
        saleId: input.saleId ?? null,
        type: input.type,
        direction,
        amountMinor: input.amountMinor,
        reason: reason.value,
      });
      const { allocations } = allocateOldestFirst(input.amountMinor, open);
      await r.ledger.insertAllocations(allocations.map((a) => ({ ...a, adjustmentId: adj.id })));
      await r.ledger.refreshSaleStatuses(await r.ledger.salesOfInstallments(allocations.map((a) => a.installmentId)), {
        writtenOff: input.type === "write_off",
      });
      await r.activity.log({ action: `adjustment.${input.type}`, entity: "adjustment", entityId: adj.id, summary: customer.name, after: { ...adj, allocations } });
      return ok({ adjustmentId: adj.id });
    });
  }
}
