import { formatInTimeZone } from "date-fns-tz";
import { domainError, DomainErrorCode, type DomainError } from "./domain-error";
import { err, ok, type Result } from "./result";

export const SHOP_TIME_ZONE = "Asia/Dhaka";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * A calendar day in the shop's time zone (Asia/Dhaka), with no time component.
 * Due dates, promise dates and "today" are ShopDates, so "overdue" never depends
 * on the server's own time zone (Vercel runs in UTC).
 */
export class ShopDate {
  private constructor(
    /** YYYY-MM-DD */
    readonly iso: string,
    /** Days since 1970-01-01, for cheap arithmetic */
    private readonly epochDay: number,
  ) {}

  static parse(iso: string): Result<ShopDate, DomainError> {
    const m = ISO_DATE_RE.exec(iso);
    if (!m) return err(domainError(DomainErrorCode.INVALID_DATE));
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const ms = Date.UTC(y, mo - 1, d);
    const check = new Date(ms);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
      return err(domainError(DomainErrorCode.INVALID_DATE));
    }
    return ok(new ShopDate(iso, ms / MS_PER_DAY));
  }

  /** Rebuild from a trusted value (DB). Throws if corrupt. */
  static of(iso: string): ShopDate {
    const r = ShopDate.parse(iso);
    if (!r.ok) throw new Error(`Invalid ShopDate: ${iso}`);
    return r.value;
  }

  /** The shop-local calendar day that contains this instant. */
  static fromInstant(instant: Date): ShopDate {
    return ShopDate.of(formatInTimeZone(instant, SHOP_TIME_ZONE, "yyyy-MM-dd"));
  }

  private static fromEpochDay(epochDay: number): ShopDate {
    const iso = new Date(epochDay * MS_PER_DAY).toISOString().slice(0, 10);
    return new ShopDate(iso, epochDay);
  }

  addDays(days: number): ShopDate {
    return ShopDate.fromEpochDay(this.epochDay + days);
  }

  /** Add calendar months, clamping to the month's last day (Jan 31 + 1 month = Feb 28/29). */
  addMonths(months: number): ShopDate {
    const [y, m, d] = this.iso.split("-").map(Number) as [number, number, number];
    const targetMonthIndex = m - 1 + months;
    const lastDay = new Date(Date.UTC(y, targetMonthIndex + 1, 0)).getUTCDate();
    const ms = Date.UTC(y, targetMonthIndex, Math.min(d, lastDay));
    return ShopDate.fromEpochDay(ms / MS_PER_DAY);
  }

  /** this − other, in whole days (positive when this is later). */
  daysSince(other: ShopDate): number {
    return this.epochDay - other.epochDay;
  }

  compare(other: ShopDate): -1 | 0 | 1 {
    return this.epochDay < other.epochDay ? -1 : this.epochDay > other.epochDay ? 1 : 0;
  }

  isBefore(other: ShopDate): boolean {
    return this.epochDay < other.epochDay;
  }

  isAfter(other: ShopDate): boolean {
    return this.epochDay > other.epochDay;
  }

  equals(other: ShopDate): boolean {
    return this.epochDay === other.epochDay;
  }

  /** Midday UTC of this date — safe to hand to formatters without shifting the day. */
  toDate(): Date {
    return new Date(this.epochDay * MS_PER_DAY + 12 * 3_600_000);
  }

  toString(): string {
    return this.iso;
  }

  toJSON(): string {
    return this.iso;
  }
}
