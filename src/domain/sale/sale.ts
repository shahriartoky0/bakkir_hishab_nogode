import { domainError, DomainErrorCode, type DomainError } from "../shared/domain-error";
import { err, ok, type Result } from "../shared/result";
import type { CustomFieldValues } from "../catalog/field-definition";

export const SALE_STATUSES = ["open", "closed", "written_off", "cancelled"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export interface ItemPhoto {
  fileKey: string;
  thumbKey: string;
}

export interface SaleItemDraft {
  categoryId: string | null;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  customFields: CustomFieldValues;
  notes: string | null;
  photos: ItemPhoto[];
}

export interface SaleTotals {
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  lineTotals: number[];
}

export const MAX_ITEMS = 30;
export const MAX_PHOTOS_PER_ITEM = 6;

/** Every item needs a name, qty ≥ 1, price ≥ 0 and at least one photo (spec 6.3). */
export function computeSaleTotals(items: readonly SaleItemDraft[], discountMinor: number): Result<SaleTotals, DomainError> {
  if (items.length === 0 || items.length > MAX_ITEMS) return err(domainError(DomainErrorCode.NO_ITEMS));
  const lineTotals: number[] = [];
  for (const [index, item] of items.entries()) {
    if (!item.name.trim()) return err(domainError(DomainErrorCode.NAME_REQUIRED, { item: index }));
    if (!Number.isInteger(item.quantity) || item.quantity < 1) return err(domainError(DomainErrorCode.VALIDATION, { item: index }));
    if (!Number.isSafeInteger(item.unitPriceMinor) || item.unitPriceMinor < 0) {
      return err(domainError(DomainErrorCode.INVALID_AMOUNT, { item: index }));
    }
    if (item.photos.length === 0 || item.photos.length > MAX_PHOTOS_PER_ITEM) {
      return err(domainError(DomainErrorCode.PHOTO_REQUIRED, { item: index }));
    }
    lineTotals.push(item.unitPriceMinor * item.quantity);
  }
  const subtotalMinor = lineTotals.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(discountMinor) || discountMinor < 0) return err(domainError(DomainErrorCode.INVALID_AMOUNT));
  if (discountMinor > subtotalMinor) return err(domainError(DomainErrorCode.DISCOUNT_TOO_LARGE));
  const totalMinor = subtotalMinor - discountMinor;
  if (totalMinor <= 0) return err(domainError(DomainErrorCode.INVALID_AMOUNT));
  return ok({ subtotalMinor, discountMinor, totalMinor, lineTotals });
}

/**
 * Items can be edited only while no payment other than the upfront one has been
 * applied to the sale (spec 6.3); afterwards use adjustments.
 */
export function canEditSale(sale: { status: SaleStatus }, hasLaterAllocations: boolean): boolean {
  return sale.status === "open" && !hasLaterAllocations;
}

/** Cancel only when no payments at all are applied (void the upfront payment first). */
export function canCancelSale(sale: { status: SaleStatus }, hasAnyAllocations: boolean): boolean {
  return sale.status === "open" && !hasAnyAllocations;
}
