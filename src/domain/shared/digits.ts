/**
 * Bangla keyboards type Bangla digits (০-৯). Every numeric input (amounts, phone
 * numbers, quantities) goes through `toLatinDigits` before validation.
 */
const BANGLA_ZERO = 0x09e6;

export function toLatinDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - BANGLA_ZERO));
}

export function toBanglaDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => String.fromCharCode(BANGLA_ZERO + Number(d)));
}
