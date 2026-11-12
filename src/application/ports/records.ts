import type { Category } from "@/domain/catalog/category";
import type { CustomFieldValues, FieldDefinition } from "@/domain/catalog/field-definition";
import type { FollowUpChannel, FollowUpOutcome } from "@/domain/followup/follow-up";
import type { AdjustmentType, Direction, PaymentMethod } from "@/domain/payment/payment";
import type { SaleStatus } from "@/domain/sale/sale";

export type { Category, FieldDefinition };

export type Locale = "bn" | "en";

export interface SettingsRecord {
  shopNameBn: string | null;
  shopNameEn: string | null;
  addressBn: string | null;
  addressEn: string | null;
  phone: string | null;
  logoKey: string | null;
  receiptFooterBn: string | null;
  receiptFooterEn: string | null;
  defaultLocale: Locale;
  useBanglaDigits: boolean;
  defaultCreditDays: number;
  salePrefix: string;
  receiptPrefix: string;
  autoLogoutMinutes: number;
  starterSetDecidedAt: Date | null;
}

export interface CustomerRecord {
  id: string;
  name: string;
  nameBn: string | null;
  phone: string;
  altPhone: string | null;
  address: string | null;
  photoKey: string | null;
  photoThumbKey: string | null;
  nidNumber: string | null;
  guarantorName: string | null;
  guarantorPhone: string | null;
  guarantorRelation: string | null;
  creditLimitMinor: number | null;
  isBlocked: boolean;
  notes: string | null;
  archivedAt: Date | null;
}

export interface SaleRecord {
  id: string;
  customerId: string;
  saleNumber: string;
  saleDate: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  status: SaleStatus;
  notes: string | null;
  idempotencyKey: string | null;
  cancelReason: string | null;
}

export interface SaleItemPhotoRecord {
  fileKey: string;
  thumbKey: string;
  sortOrder: number;
}

export interface SaleItemRecord {
  id: string;
  saleId: string;
  categoryId: string | null;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  customFields: CustomFieldValues;
  notes: string | null;
  sortOrder: number;
  photos: SaleItemPhotoRecord[];
}

export interface InstallmentRecord {
  id: string;
  customerId: string;
  saleId: string | null;
  adjustmentId: string | null;
  seq: number;
  dueDate: string;
  amountMinor: number;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  saleId: string | null;
  receiptNumber: string;
  amountMinor: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: Date;
  note: string | null;
  status: "active" | "voided";
  voidReason: string | null;
  voidedAt: Date | null;
  idempotencyKey: string | null;
  isUpfront: boolean;
}

export interface AdjustmentRecord {
  id: string;
  customerId: string;
  saleId: string | null;
  type: AdjustmentType;
  direction: Direction;
  amountMinor: number;
  reason: string;
  createdAt: Date;
}

export interface FollowUpRecord {
  id: string;
  customerId: string;
  saleId: string | null;
  channel: FollowUpChannel;
  outcome: FollowUpOutcome;
  note: string | null;
  promisedAmountMinor: number | null;
  promisedDate: string | null;
  createdAt: Date;
}

export interface ActivityEntry {
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
