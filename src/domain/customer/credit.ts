export type CreditWarning = "BLOCKED" | "OVER_LIMIT";

/**
 * Warnings shown before a new credit sale (spec 6.2). They don't block the sale:
 * the owner can "continue anyway".
 */
export function creditWarnings(input: {
  isBlocked: boolean;
  creditLimitMinor: number | null;
  currentBalanceMinor: number;
  newCreditMinor: number;
}): CreditWarning[] {
  const warnings: CreditWarning[] = [];
  if (input.isBlocked) warnings.push("BLOCKED");
  if (input.creditLimitMinor !== null && input.currentBalanceMinor + input.newCreditMinor > input.creditLimitMinor) {
    warnings.push("OVER_LIMIT");
  }
  return warnings;
}

/** 0–100+ share of the credit limit in use (null when no limit). */
export function creditUsagePercent(balanceMinor: number, limitMinor: number | null): number | null {
  if (limitMinor === null || limitMinor <= 0) return null;
  return Math.round((balanceMinor / limitMinor) * 100);
}
