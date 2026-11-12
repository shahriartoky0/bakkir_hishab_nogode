import { describe, expect, it } from "vitest";
import { integerIssue, moneyIssue, sanitizeNumeric, toMinor } from "@/presentation/lib/numeric";
import { integerField, moneyField, optionalNidField } from "@/presentation/schemas/fields";
import { createZodErrorMap } from "@/presentation/schemas/zod-error-map";

describe("sanitizeNumeric", () => {
  it("drops letters but keeps Bangla and English digits", () => {
    expect(sanitizeNumeric("১২abc3", "integer")).toBe("১২3");
    expect(sanitizeNumeric("12.5", "integer")).toBe("125");
  });

  it("keeps one decimal point and caps money at 2 decimals", () => {
    expect(sanitizeNumeric("1,250.505x", "money")).toBe("1,250.50");
    expect(sanitizeNumeric("1.2.3", "money")).toBe("1.23");
    expect(sanitizeNumeric("4.12345", "decimal")).toBe("4.123");
  });

  it("allows + only at the start of a phone number", () => {
    expect(sanitizeNumeric("+880 17-12a+34", "phone")).toBe("+880 17-1234");
  });
});

describe("numeric issues", () => {
  it("names the exact money problem", () => {
    expect(moneyIssue("")).toBe("required");
    expect(moneyIssue("", { required: false })).toBeNull();
    expect(moneyIssue(".")).toBe("notANumber");
    expect(moneyIssue("12.345")).toBe("maxTwoDecimals");
    expect(moneyIssue("১,২৫০.৫০")).toBeNull();
    expect(moneyIssue("0.5", { min: 1 })).toBe("minValue");
    expect(toMinor("১,২৫০.৫")).toBe(125_050);
  });

  it("names the exact whole-number problem", () => {
    expect(integerIssue("")).toBe("required");
    expect(integerIssue("1.5")).toBe("wholeNumber");
    expect(integerIssue("0", { min: 1 })).toBe("minValue");
    expect(integerIssue("61", { max: 60 })).toBe("maxValue");
    expect(integerIssue("৩", { min: 1, max: 60 })).toBeNull();
  });
});

describe("schema fields give specific messages", () => {
  const map = createZodErrorMap((k, v) => (v ? `${k}:${JSON.stringify(v)}` : k));
  const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

  it("money", () => {
    expect(msg(moneyField().safeParse("12.345", { error: map }))).toMatch(/^maxTwoDecimals/);
    expect(moneyField().parse("১,০০০")).toBe(100_000);
  });

  it("integer with range values", () => {
    expect(msg(integerField({ min: 5, max: 240 }).safeParse("4", { error: map }))).toBe('minValue:{"min":5,"max":240}');
    expect(msg(integerField({ min: 5, max: 240 }).safeParse("2.5", { error: map }))).toMatch(/^wholeNumber/);
  });

  it("NID length", () => {
    expect(msg(optionalNidField().safeParse("12345", { error: map }))).toBe("nidLength");
    expect(optionalNidField().parse("১২৩৪৫৬৭৮৯০")).toBe("1234567890");
    expect(optionalNidField().parse("")).toBeNull();
  });
});
