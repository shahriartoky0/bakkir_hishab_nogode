import { domainError, DomainErrorCode, err, ok, ShopDate, type DomainError, type Result } from "@/domain/shared";
import type { Clock } from "../ports/clock";

/** "INV-" + 7 → "INV-000007" */
export function formatDocNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(6, "0")}`;
}

/**
 * Payments are entered by date. Today → now; a past day → 12:00 Dhaka time that
 * day (so the Dhaka calendar date is always right). Future dates are rejected.
 */
export function paidAtFromDate(dateIso: string | null | undefined, clock: Clock): Result<Date, DomainError> {
  const now = clock.now();
  const today = ShopDate.fromInstant(now);
  if (!dateIso) return ok(now);
  const d = ShopDate.parse(dateIso);
  if (!d.ok || d.value.isAfter(today)) return err(domainError(DomainErrorCode.INVALID_DATE));
  if (d.value.equals(today)) return ok(now);
  return ok(new Date(`${d.value.iso}T06:00:00.000Z`)); // 12:00 in Asia/Dhaka (UTC+6)
}

export function todayIn(clock: Clock): ShopDate {
  return ShopDate.fromInstant(clock.now());
}
