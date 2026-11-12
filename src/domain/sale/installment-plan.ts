import { domainError, DomainErrorCode, type DomainError } from "../shared/domain-error";
import { Money } from "../shared/money";
import { err, ok, type Result } from "../shared/result";
import { ShopDate } from "../shared/shop-date";

export const QUICK_DUE_DAYS = [7, 15, 30, 60, 90] as const;
export const MAX_INSTALLMENTS = 60;

export type RepaymentPlan =
  | { kind: "single"; dueDate: string }
  | {
      kind: "installments";
      count: number;
      frequency: "monthly" | "weekly";
      firstDate: string;
      /** Optional edited amounts (paisa); must sum to the financed amount. */
      amounts?: number[];
      /** Optional edited dates; default derived from firstDate + frequency. */
      dates?: string[];
    };

export interface ScheduledInstallment {
  seq: number;
  dueDate: string;
  amountMinor: number;
}

/** Due dates for an installment plan: firstDate, then +1 month / +1 week each. */
export function planDates(firstDate: ShopDate, count: number, frequency: "monthly" | "weekly"): ShopDate[] {
  return Array.from({ length: count }, (_, i) => (frequency === "monthly" ? firstDate.addMonths(i) : firstDate.addDays(7 * i)));
}

/**
 * Build the repayment schedule for the financed part of a sale (total − upfront).
 * Equal split with the remainder on the last installment; edited amounts must
 * be positive and sum exactly to the financed amount; dates never before the sale date
 * and never decreasing.
 */
export function buildSchedule(
  financedMinor: number,
  plan: RepaymentPlan,
  saleDate: ShopDate,
): Result<ScheduledInstallment[], DomainError> {
  if (financedMinor === 0) return ok([]);
  if (!Number.isSafeInteger(financedMinor) || financedMinor < 0) return err(domainError(DomainErrorCode.INVALID_AMOUNT));

  if (plan.kind === "single") {
    const due = ShopDate.parse(plan.dueDate);
    if (!due.ok || due.value.isBefore(saleDate)) return err(domainError(DomainErrorCode.INVALID_SCHEDULE));
    return ok([{ seq: 1, dueDate: due.value.iso, amountMinor: financedMinor }]);
  }

  const { count, frequency } = plan;
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) return err(domainError(DomainErrorCode.INVALID_SCHEDULE));
  const first = ShopDate.parse(plan.firstDate);
  if (!first.ok || first.value.isBefore(saleDate)) return err(domainError(DomainErrorCode.INVALID_SCHEDULE));

  let dates = planDates(first.value, count, frequency);
  if (plan.dates) {
    if (plan.dates.length !== count) return err(domainError(DomainErrorCode.INVALID_SCHEDULE));
    const parsed = plan.dates.map((d) => ShopDate.parse(d));
    if (parsed.some((p) => !p.ok)) return err(domainError(DomainErrorCode.INVALID_SCHEDULE));
    dates = parsed.map((p) => (p as { ok: true; value: ShopDate }).value);
    for (let i = 0; i < dates.length; i++) {
      if (dates[i]!.isBefore(saleDate) || (i > 0 && dates[i]!.isBefore(dates[i - 1]!))) {
        return err(domainError(DomainErrorCode.INVALID_SCHEDULE));
      }
    }
  }

  let amounts: number[];
  if (plan.amounts) {
    if (plan.amounts.length !== count || plan.amounts.some((a) => !Number.isSafeInteger(a) || a <= 0)) {
      return err(domainError(DomainErrorCode.INVALID_SCHEDULE));
    }
    const sum = plan.amounts.reduce((a, b) => a + b, 0);
    if (sum !== financedMinor) {
      return err(domainError(DomainErrorCode.SCHEDULE_MISMATCH, { expected: financedMinor, actual: sum }));
    }
    amounts = plan.amounts;
  } else {
    amounts = Money.fromMinor(financedMinor).split(count).map((m) => m.minor);
    if (amounts.some((a) => a <= 0)) return err(domainError(DomainErrorCode.INVALID_SCHEDULE));
  }

  return ok(dates.map((d, i) => ({ seq: i + 1, dueDate: d.iso, amountMinor: amounts[i]! })));
}

/**
 * Full schedule including the upfront part as installment #0 (due on the sale date)
 * so that installments always sum to the sale total and allocations stay the
 * single source of truth.
 */
export function scheduleWithUpfront(
  totalMinor: number,
  upfrontMinor: number,
  plan: RepaymentPlan,
  saleDate: ShopDate,
): Result<ScheduledInstallment[], DomainError> {
  if (!Number.isSafeInteger(upfrontMinor) || upfrontMinor < 0) return err(domainError(DomainErrorCode.INVALID_AMOUNT));
  if (upfrontMinor > totalMinor) return err(domainError(DomainErrorCode.UPFRONT_TOO_LARGE));
  const rest = buildSchedule(totalMinor - upfrontMinor, plan, saleDate);
  if (!rest.ok) return rest;
  const upfront = upfrontMinor > 0 ? [{ seq: 0, dueDate: saleDate.iso, amountMinor: upfrontMinor }] : [];
  return ok([...upfront, ...rest.value]);
}
