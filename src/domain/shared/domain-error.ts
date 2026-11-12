/**
 * Domain errors carry a stable machine code, never human text.
 * The presentation layer translates `errors.<code>` from the message files.
 */
export const DomainErrorCode = {
  VALIDATION: "VALIDATION",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  INVALID_PHONE: "INVALID_PHONE",
  INVALID_DATE: "INVALID_DATE",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
  UNSUPPORTED_FILE_TYPE: "UNSUPPORTED_FILE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  // catalog
  NAME_REQUIRED: "NAME_REQUIRED",
  CATEGORY_DEPTH: "CATEGORY_DEPTH",
  INVALID_FIELD_KEY: "INVALID_FIELD_KEY",
  DUPLICATE_FIELD_KEY: "DUPLICATE_FIELD_KEY",
  OPTIONS_REQUIRED: "OPTIONS_REQUIRED",
  INVALID_CUSTOM_FIELDS: "INVALID_CUSTOM_FIELDS",
  // customers
  DUPLICATE_PHONE: "DUPLICATE_PHONE",
  CUSTOMER_ARCHIVED: "CUSTOMER_ARCHIVED",
  // sales
  NO_ITEMS: "NO_ITEMS",
  PHOTO_REQUIRED: "PHOTO_REQUIRED",
  DISCOUNT_TOO_LARGE: "DISCOUNT_TOO_LARGE",
  UPFRONT_TOO_LARGE: "UPFRONT_TOO_LARGE",
  INVALID_SCHEDULE: "INVALID_SCHEDULE",
  SCHEDULE_MISMATCH: "SCHEDULE_MISMATCH",
  SALE_HAS_PAYMENTS: "SALE_HAS_PAYMENTS",
  SALE_NOT_EDITABLE: "SALE_NOT_EDITABLE",
  CREDIT_WARNING: "CREDIT_WARNING",
  // payments
  OVERPAYMENT: "OVERPAYMENT",
  NOTHING_DUE: "NOTHING_DUE",
  ALREADY_VOIDED: "ALREADY_VOIDED",
  REASON_REQUIRED: "REASON_REQUIRED",
  // account
  WRONG_PASSWORD: "WRONG_PASSWORD",
  // admin
  CONFIRM_REQUIRED: "CONFIRM_REQUIRED",
  INVALID_RANGE: "INVALID_RANGE",
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export type ErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

export interface DomainError<C extends string = DomainErrorCode> {
  readonly code: C;
  /** Optional structured details (e.g. { existingId }) — never translated text. */
  readonly details?: ErrorDetails;
}

export function domainError<C extends string>(code: C, details?: ErrorDetails): DomainError<C> {
  return details ? { code, details } : { code };
}
