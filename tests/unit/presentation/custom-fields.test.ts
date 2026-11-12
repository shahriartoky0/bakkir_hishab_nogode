import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/domain/catalog/field-definition";
import { applyOverrides, flattenMessages } from "@/presentation/i18n/messages";
import { customFieldInputValue, customFieldText } from "@/presentation/lib/custom-field-text";
import { buildCustomFieldsSchema, checkCustomFields } from "@/presentation/schemas/custom-fields";
import { createZodErrorMap } from "@/presentation/schemas/zod-error-map";

const def = (over: Partial<FieldDefinition>): FieldDefinition => ({
  id: over.key ?? "f",
  categoryId: null,
  key: "f",
  labelBn: null,
  labelEn: "F",
  type: "text",
  options: [],
  unitBn: null,
  unitEn: null,
  isRequired: false,
  showOnReceipt: true,
  sortOrder: 0,
  archivedAt: null,
  ...over,
});

const fields = [
  def({ key: "weight", type: "decimal", isRequired: true, unitBn: "গ্রাম", unitEn: "g" }),
  def({ key: "karat", type: "select", options: [{ value: "22K", labelBn: "২২ ক্যারেট", labelEn: "22K" }] }),
  def({ key: "making", type: "money" }),
  def({ key: "pieces", type: "number" }),
  def({ key: "hallmark", type: "boolean" }),
  def({ key: "bought", type: "date" }),
];

const errorMap = createZodErrorMap((k) => k);

describe("runtime custom field schema", () => {
  it("accepts Bangla digits and optional blanks", () => {
    const r = buildCustomFieldsSchema(fields).safeParse({ weight: "৪.৫", karat: "22K", making: "১,২০০", pieces: "", hallmark: true });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ weight: "4.5", karat: "22K", making: "1,200" });
  });

  it("reports required, invalid and bad options per field", () => {
    const errors = checkCustomFields(fields, { weight: "", karat: "18K", making: "abc", pieces: "1.5", bought: "2026-13-01" }, errorMap);
    expect(errors).toEqual({ weight: "required", karat: "invalid", making: "notANumber", pieces: "wholeNumber", bought: "invalidDate" });
  });
});

describe("custom field display", () => {
  const ctx = {
    fmt: { money: (m: number) => `৳${m / 100}`, number: (n: number) => String(n), date: (d: string) => d },
    text: (bn: string | null | undefined, en: string | null | undefined) => bn ?? en ?? "",
    yes: "হ্যাঁ",
    no: "না",
  };

  it("formats values with units and option labels", () => {
    expect(customFieldText(fields[0]!, 4.5, ctx)).toBe("4.5 গ্রাম");
    expect(customFieldText(fields[1]!, "22K", ctx)).toBe("২২ ক্যারেট");
    expect(customFieldText(fields[2]!, 120000, ctx)).toBe("৳1200");
    expect(customFieldText(fields[4]!, true, ctx)).toBe("হ্যাঁ");
    expect(customFieldText(fields[3]!, undefined, ctx)).toBeNull();
  });

  it("turns stored values back into form input", () => {
    expect(customFieldInputValue(fields[2]!, 120050)).toBe("1200.5");
    expect(customFieldInputValue(fields[4]!, undefined)).toBe(false);
    expect(customFieldInputValue(fields[0]!, 4.5)).toBe("4.5");
  });
});

describe("wording overrides", () => {
  it("applies known keys and ignores unknown ones without mutating the base", () => {
    const base = { nav: { home: "হোম" }, common: { save: "সংরক্ষণ" } } as never;
    const merged = applyOverrides(base, [
      { key: "nav.home", value: "শুরু" },
      { key: "nav.missing", value: "x" },
      { key: "common", value: "x" },
    ]) as unknown as { nav: { home: string }; common: { save: string } };
    expect(merged.nav.home).toBe("শুরু");
    expect(merged.common.save).toBe("সংরক্ষণ");
    expect((base as { nav: { home: string } }).nav.home).toBe("হোম");
    expect(flattenMessages({ a: { b: "1" }, c: "2" })).toEqual(new Map([["a.b", "1"], ["c", "2"]]));
  });
});
