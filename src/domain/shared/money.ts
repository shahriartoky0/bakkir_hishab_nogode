import { toLatinDigits } from "./digits";
import { domainError, DomainErrorCode, type DomainError } from "./domain-error";
import { err, ok, type Result } from "./result";

/**
 * Money in integer paisa (1 ৳ = 100 paisa). Never floats.
 *
 * Held as a JS number: Number.MAX_SAFE_INTEGER paisa ≈ ৳ 90 trillion, far beyond
 * any shop total, and every operation asserts the result stays a safe integer.
 * DB columns are `bigint` read in number mode.
 */
export class Money {
  private constructor(readonly minor: number) {}

  static readonly ZERO = new Money(0);

  static fromMinor(minor: number): Money {
    if (!Number.isSafeInteger(minor)) {
      throw new RangeError(`Money.fromMinor: not a safe integer: ${minor}`);
    }
    return minor === 0 ? Money.ZERO : new Money(minor);
  }

  /**
   * Parse user input in taka: "1250", "1,250.50", "১,২৫০.৫", "৳ 500".
   * At most two decimal places. Negative values are rejected (use adjustments for credits).
   */
  static parse(input: string): Result<Money, DomainError> {
    const cleaned = toLatinDigits(input)
      .trim()
      .replace(/^(৳|tk\.?|bdt)/i, "")
      .replace(/[,\s_]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
      return err(domainError(DomainErrorCode.INVALID_AMOUNT));
    }
    const [whole = "0", frac = ""] = cleaned.split(".");
    const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    if (!Number.isSafeInteger(minor)) {
      return err(domainError(DomainErrorCode.INVALID_AMOUNT));
    }
    return ok(Money.fromMinor(minor));
  }

  add(other: Money): Money {
    return Money.fromMinor(this.minor + other.minor);
  }

  subtract(other: Money): Money {
    return Money.fromMinor(this.minor - other.minor);
  }

  /** Multiply by an integer quantity (e.g. 3 rings). */
  times(quantity: number): Money {
    if (!Number.isInteger(quantity)) {
      throw new RangeError(`Money.times: quantity must be an integer: ${quantity}`);
    }
    return Money.fromMinor(this.minor * quantity);
  }

  /**
   * Split into `parts` amounts that sum exactly to this amount.
   * Equal split, remainder on the LAST part (spec 6.3 installments).
   */
  split(parts: number): Money[] {
    if (!Number.isInteger(parts) || parts < 1) {
      throw new RangeError(`Money.split: parts must be a positive integer: ${parts}`);
    }
    const base = Math.floor(this.minor / parts);
    const last = this.minor - base * (parts - 1);
    return Array.from({ length: parts }, (_, i) => Money.fromMinor(i === parts - 1 ? last : base));
  }

  min(other: Money): Money {
    return this.minor <= other.minor ? this : other;
  }

  max(other: Money): Money {
    return this.minor >= other.minor ? this : other;
  }

  isZero(): boolean {
    return this.minor === 0;
  }

  isPositive(): boolean {
    return this.minor > 0;
  }

  isNegative(): boolean {
    return this.minor < 0;
  }

  equals(other: Money): boolean {
    return this.minor === other.minor;
  }

  compare(other: Money): -1 | 0 | 1 {
    return this.minor < other.minor ? -1 : this.minor > other.minor ? 1 : 0;
  }

  greaterThan(other: Money): boolean {
    return this.minor > other.minor;
  }

  lessThan(other: Money): boolean {
    return this.minor < other.minor;
  }

  static sum(items: readonly Money[]): Money {
    return items.reduce((acc, m) => acc.add(m), Money.ZERO);
  }

  toJSON(): number {
    return this.minor;
  }
}
