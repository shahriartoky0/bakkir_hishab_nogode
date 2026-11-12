import { domainError, DomainErrorCode, type DomainError } from "../shared/domain-error";
import { err, ok, type Result } from "../shared/result";

export const PAYMENT_METHODS = ["cash", "bkash", "nagad", "rocket", "bank", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ADJUSTMENT_TYPES = ["opening_balance", "return", "discount", "write_off", "correction"] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];
export type Direction = "debit" | "credit";

/** debit = customer owes more; credit = customer owes less. */
export function directionFor(type: AdjustmentType, correctionDirection?: Direction): Direction {
  switch (type) {
    case "opening_balance":
      return "debit";
    case "correction":
      return correctionDirection ?? "credit";
    default:
      return "credit";
  }
}

export interface OpenInstallment {
  id: string;
  saleId: string | null;
  dueDate: string;
  seq: number;
  remainingMinor: number;
}

export interface Allocation {
  installmentId: string;
  amountMinor: number;
}

/** Oldest due first (by due date, then installment number), never over-allocating. */
export function allocateOldestFirst(amountMinor: number, open: readonly OpenInstallment[]): { allocations: Allocation[]; leftoverMinor: number } {
  const sorted = [...open]
    .filter((i) => i.remainingMinor > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.seq - b.seq || a.id.localeCompare(b.id));
  const allocations: Allocation[] = [];
  let left = amountMinor;
  for (const inst of sorted) {
    if (left <= 0) break;
    const take = Math.min(left, inst.remainingMinor);
    allocations.push({ installmentId: inst.id, amountMinor: take });
    left -= take;
  }
  return { allocations, leftoverMinor: left };
}

/** A payment or credit can't exceed what is owed (on the chosen sale or overall). */
export function validateCreditAmount(amountMinor: number, owedMinor: number): Result<null, DomainError> {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return err(domainError(DomainErrorCode.INVALID_AMOUNT));
  if (owedMinor <= 0) return err(domainError(DomainErrorCode.NOTHING_DUE));
  if (amountMinor > owedMinor) return err(domainError(DomainErrorCode.OVERPAYMENT, { maxMinor: owedMinor }));
  return ok(null);
}

export function validateReason(reason: string | null | undefined): Result<string, DomainError> {
  const r = reason?.trim() ?? "";
  if (r.length < 3) return err(domainError(DomainErrorCode.REASON_REQUIRED));
  return ok(r.slice(0, 500));
}
