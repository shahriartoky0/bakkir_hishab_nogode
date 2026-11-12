import { describe, expect, it } from "vitest";
import { buildTree, lineage, normalizeNames, validateParent, type Category } from "@/domain/catalog/category";
import {
  applicableFields,
  isValidFieldKey,
  suggestFieldKey,
  validateCustomFields,
  validateFieldDefinition,
  type FieldDefinition,
} from "@/domain/catalog/field-definition";

const cat = (id: string, parentId: string | null, sortOrder = 0): Category => ({
  id,
  parentId,
  nameBn: null,
  nameEn: id,
  sortOrder,
  archivedAt: null,
});

const field = (over: Partial<FieldDefinition>): FieldDefinition => ({
  id: over.key ?? "f",
  categoryId: null,
  key: "f",
  labelBn: "ফিল্ড",
  labelEn: "Field",
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

const categories = [cat("gold", null, 0), cat("ring", "gold", 0), cat("silver", null, 1)];

describe("categories", () => {
  it("requires at least one name", () => {
    expect(normalizeNames({ nameBn: " ", nameEn: "" }).ok).toBe(false);
    expect(normalizeNames({ nameBn: "সোনা" })).toEqual({ ok: true, value: { nameBn: "সোনা", nameEn: null } });
  });

  it("allows only 2 levels", () => {
    expect(validateParent(null).ok).toBe(true);
    expect(validateParent(categories[0]).ok).toBe(true);
    const r = validateParent(categories[1]);
    expect(!r.ok && r.error.code).toBe("CATEGORY_DEPTH");
    expect(validateParent(undefined).ok).toBe(false);
  });

  it("builds an ordered tree and lineage", () => {
    const tree = buildTree(categories);
    expect(tree.map((n) => n.id)).toEqual(["gold", "silver"]);
    expect(tree[0]!.children.map((c) => c.id)).toEqual(["ring"]);
    expect(lineage("ring", categories)).toEqual(["ring", "gold"]);
  });
});

describe("field definitions", () => {
  it("validates keys and suggests them from labels", () => {
    expect(isValidFieldKey("making_charge")).toBe(true);
    expect(isValidFieldKey("Making Charge")).toBe(false);
    expect(isValidFieldKey("1abc")).toBe(false);
    expect(suggestFieldKey("Making charge (৳)")).toBe("making_charge");
    expect(suggestFieldKey("ওজন")).toBe("field");
  });

  it("rejects duplicate keys and selects without options", () => {
    expect(validateFieldDefinition({ key: "weight", labelEn: "W", type: "decimal" }, ["weight"]).ok).toBe(false);
    const sel = validateFieldDefinition({ key: "karat", labelEn: "Karat", type: "select", options: [] }, []);
    expect(!sel.ok && sel.error.code).toBe("OPTIONS_REQUIRED");
  });

  it("applies global, parent and own fields (not archived)", () => {
    const fields = [
      field({ id: "g", key: "weight", categoryId: null }),
      field({ id: "p", key: "karat", categoryId: "gold" }),
      field({ id: "own", key: "size", categoryId: "ring" }),
      field({ id: "other", key: "purity", categoryId: "silver" }),
      field({ id: "old", key: "old", categoryId: "ring", archivedAt: new Date() }),
    ];
    expect(applicableFields("ring", categories, fields).map((f) => f.id)).toEqual(["g", "p", "own"]);
    expect(applicableFields(null, categories, fields).map((f) => f.id)).toEqual(["g"]);
    expect(applicableFields("ring", categories, fields, { includeArchived: true })).toHaveLength(4);
  });
});

describe("custom field values (runtime validation)", () => {
  const defs = [
    field({ key: "weight", type: "decimal", isRequired: true }),
    field({ key: "pieces", type: "number" }),
    field({ key: "making", type: "money" }),
    field({ key: "karat", type: "select", options: [{ value: "22K", labelBn: null, labelEn: "22K" }] }),
    field({ key: "made_on", type: "date" }),
    field({ key: "hallmark", type: "boolean" }),
  ];

  it("normalizes Bangla digits and types", () => {
    const r = validateCustomFields(defs, {
      weight: "১১.৬৬৪",
      pieces: "২",
      making: "১,৫০০",
      karat: "22K",
      made_on: "2026-11-01",
      hallmark: "true",
      unknown: "dropped",
    });
    expect(r).toEqual({
      ok: true,
      value: { weight: 11.664, pieces: 2, making: 150_000, karat: "22K", made_on: "2026-11-01", hallmark: true },
    });
  });

  it("reports per-field errors", () => {
    const r = validateCustomFields(defs, { weight: "", pieces: "1.5", karat: "18K", made_on: "2026-02-30" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("INVALID_CUSTOM_FIELDS");
      expect(r.error.details).toEqual({ weight: "required", pieces: "invalid", karat: "invalidOption", made_on: "invalid" });
    }
  });
});
