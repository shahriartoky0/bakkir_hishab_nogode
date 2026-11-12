import { toLatinDigits } from "./digits";
import { domainError, DomainErrorCode, type DomainError } from "./domain-error";
import { err, ok, type Result } from "./result";

/**
 * Bangladeshi mobile number, normalized to E.164 (+8801XXXXXXXXX).
 *
 * Accepts 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX, 008801XXXXXXXXX,
 * with spaces/dashes/brackets and Bangla or English digits.
 * Operator prefixes 013–019 are valid.
 */
const NATIONAL_MOBILE_RE = /^01[3-9]\d{8}$/;

export class PhoneNumber {
  private constructor(
    /** E.164 form, e.g. +8801712345678 */
    readonly e164: string,
  ) {}

  static parse(input: string): Result<PhoneNumber, DomainError> {
    let digits = toLatinDigits(input).replace(/[\s\-().]/g, "");
    if (digits.startsWith("+")) digits = digits.slice(1);
    else if (digits.startsWith("00")) digits = digits.slice(2);
    if (!/^\d+$/.test(digits)) return err(domainError(DomainErrorCode.INVALID_PHONE));

    let national: string;
    if (digits.startsWith("880")) national = "0" + digits.slice(3);
    else if (digits.startsWith("0")) national = digits;
    else if (digits.length === 10 && digits.startsWith("1")) national = "0" + digits;
    else return err(domainError(DomainErrorCode.INVALID_PHONE));

    if (!NATIONAL_MOBILE_RE.test(national)) {
      return err(domainError(DomainErrorCode.INVALID_PHONE));
    }
    return ok(new PhoneNumber("+88" + national));
  }

  /** Rebuild from an already-normalized DB value. Throws if the value is corrupt. */
  static fromE164(e164: string): PhoneNumber {
    const r = PhoneNumber.parse(e164);
    if (!r.ok || r.value.e164 !== e164) throw new Error(`Invalid stored phone: ${e164}`);
    return r.value;
  }

  /** Local form shown to people: 01712345678 */
  get national(): string {
    return this.e164.slice(3);
  }

  /** Digits for wa.me links: 8801712345678 */
  get whatsappDigits(): string {
    return this.e164.slice(1);
  }

  get telUri(): string {
    return `tel:${this.e164}`;
  }

  get whatsappUrl(): string {
    return `https://wa.me/${this.whatsappDigits}`;
  }

  equals(other: PhoneNumber): boolean {
    return this.e164 === other.e164;
  }

  toString(): string {
    return this.e164;
  }
}
