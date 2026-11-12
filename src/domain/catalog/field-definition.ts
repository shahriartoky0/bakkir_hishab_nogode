import { hasAnyText } from "../shared/bilingual";
import { toLatinDigits } from "../shared/digits";
import { domainError, DomainErrorCode, type DomainError } from "../shared/domain-error";
import { Money } from "../shared/money";
import { err, ok, type Result } from "../shared/result";
import { ShopDate } from "../shared/shop-date";
import { lineage, type Category } from "./category";

export const FIELD_TYPES = ["text", "number", "decimal", "money", "select", "date", "boolean"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface SelectOption {
  value: string;
  labelBn: string | null;
  labelEn: string | null;
}

export interface FieldDefinition {
  id: string;
  /** null = applies to every item */
  categoryId: string | null;
  /** Immutable after creation; the key inside sale_items.custom_fields */
  key: string;
  labelBn: string | null;
  labelEn: string | null;
  type: FieldType;
  options: SelectOption[];
  unitBn: string | null;
  unitEn: string | null;
  isRequired: boolean;
  showOnReceipt: boolean;
  sortOrder: number;
  archivedAt: Date | null;
}

/** Stored values: number fields as numbers, money as paisa, date as YYYY-MM-DD. */
export type CustomFieldValue = string | number | boolean;
export type CustomFieldValues = Record<string, CustomFieldValue>;

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

export function isValidFieldKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Suggest a key from an English (or any) label: "Making charge" → "making_charge". */
export function suggestFieldKey(label: string): string {
  const slug = label
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f_$1")
    .slice(0, 40);
  return slug || "field";
}

export interface FieldDefinitionInput {
  key: string;
  labelBn?: string | null;
  labelEn?: string | null;
  type: FieldType;
  options?: SelectOption[];
  unitBn?: string | null;
  unitEn?: string | null;
  isRequired?: boolean;
  showOnReceipt?: boolean;
}

export function validateFieldDefinition(
  input: FieldDefinitionInput,
  existingKeysInScope: readonly string[],
): Result<Omit<FieldDefinition, "id" | "categoryId" | "sortOrder" | "archivedAt">, DomainError> {
  const key = input.key.trim();
  if (!isValidFieldKey(key)) return err(domainError(DomainErrorCode.INVALID_FIELD_KEY));
  if (existingKeysInScope.includes(key)) return err(domainError(DomainErrorCode.DUPLICATE_FIELD_KEY, { key }));
  if (!hasAnyText(input.labelBn, input.labelEn)) return err(domainError(DomainErrorCode.NAME_REQUIRED));
  if (!FIELD_TYPES.includes(input.type)) return err(domainError(DomainErrorCode.VALIDATION));

  let options: SelectOption[] = [];
  if (input.type === "select") {
    options = (input.options ?? [])
      .map((o) => ({ value: o.value.trim(), labelBn: o.labelBn?.trim() || null, labelEn: o.labelEn?.trim() || null }))
      .filter((o) => o.value);
    const values = new Set(options.map((o) => o.value));
    if (options.length === 0 || values.size !== options.length) {
      return err(domainError(DomainErrorCode.OPTIONS_REQUIRED));
    }
  }

  return ok({
    key,
    labelBn: input.labelBn?.trim() || null,
    labelEn: input.labelEn?.trim() || null,
    type: input.type,
    options,
    unitBn: input.unitBn?.trim() || null,
    unitEn: input.unitEn?.trim() || null,
    isRequired: Boolean(input.isRequired),
    showOnReceipt: input.showOnReceipt ?? true,
  });
}

/** Active fields for an item in `categoryId`: global ones + those of the category and its parent. */
export function applicableFields(
  categoryId: string | null,
  categories: readonly Category[],
  fields: readonly FieldDefinition[],
  opts: { includeArchived?: boolean } = {},
): FieldDefinition[] {
  const scope = new Set<string | null>([null, ...lineage(categoryId, categories)]);
  return fields
    .filter((f) => scope.has(f.categoryId) && (opts.includeArchived || f.archivedAt === null))
    .sort((a, b) => (a.categoryId === null ? 0 : 1) - (b.categoryId === null ? 0 : 1) || a.sortOrder - b.sortOrder);
}

export type FieldErrorCode = "required" | "invalid" | "invalidOption";

/**
 * Validate raw form input (strings, possibly with Bangla digits) against field
 * definitions and normalize to stored values. Unknown keys are dropped.
 */
export function validateCustomFields(
  fields: readonly FieldDefinition[],
  raw: Readonly<Record<string, unknown>>,
): Result<CustomFieldValues, DomainError> {
  const values: CustomFieldValues = {};
  const errors: Record<string, FieldErrorCode> = {};

  for (const f of fields) {
    const input = raw[f.key];
    const text = typeof input === "string" ? toLatinDigits(input).trim() : input;
    const empty = text === undefined || text === null || text === "" || (f.type === "boolean" && text === false);

    if (empty) {
      if (f.isRequired && f.type !== "boolean") errors[f.key] = "required";
      if (f.type === "boolean" && text === false) values[f.key] = false;
      continue;
    }

    switch (f.type) {
      case "text":
        if (typeof text !== "string") errors[f.key] = "invalid";
        else values[f.key] = text.slice(0, 500);
        break;
      case "number": {
        const n = typeof text === "number" ? text : Number(text);
        if (!Number.isSafeInteger(n) || (typeof text === "string" && !/^-?\d+$/.test(text))) errors[f.key] = "invalid";
        else values[f.key] = n;
        break;
      }
      case "decimal": {
        const s = String(text);
        if (!/^-?\d+(\.\d{1,3})?$/.test(s)) errors[f.key] = "invalid";
        else values[f.key] = Number(s);
        break;
      }
      case "money": {
        const m = typeof text === "number" ? (Number.isSafeInteger(text) ? ok(Money.fromMinor(text)) : null) : Money.parse(String(text));
        if (!m || !m.ok) errors[f.key] = "invalid";
        else values[f.key] = m.value.minor;
        break;
      }
      case "select":
        if (!f.options.some((o) => o.value === text)) errors[f.key] = "invalidOption";
        else values[f.key] = String(text);
        break;
      case "date":
        if (!ShopDate.parse(String(text)).ok) errors[f.key] = "invalid";
        else values[f.key] = String(text);
        break;
      case "boolean":
        values[f.key] = text === true || text === "true" || text === "on";
        break;
    }
  }

  if (Object.keys(errors).length > 0) return err(domainError(DomainErrorCode.INVALID_CUSTOM_FIELDS, errors));
  return ok(values);
}
