import { describe, expect, it } from "vitest";
import { Money } from "@/domain/shared/money";
import { unwrap } from "@/domain/shared/result";

const parse = (s: string) => unwrap(Money.parse(s)).minor;

describe("Money.parse", () => {
  it.each([
    ["1250", 125_000],
    ["1,250", 125_000],
    ["1,25,000", 12_500_000],
    ["1250.5", 125_050],
    ["1250.50", 125_050],
    ["0.01", 1],
    ["৳ 500", 50_000],
    ["Tk 500", 50_000],
    ["  700  ", 70_000],
    ["১২৫০", 125_000],
    ["১,২৫,০০০.৫০", 12_500_050],
  ])("parses %s → %i paisa", (input, minor) => {
    expect(parse(input)).toBe(minor);
  });

  it.each(["", "abc", "-50", "12.345", "1.2.3", "12a", "."])("rejects %j", (input) => {
    const r = Money.parse(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_AMOUNT");
  });
});

describe("Money arithmetic", () => {
  const m = Money.fromMinor;

  it("adds, subtracts and multiplies by integer quantity", () => {
    expect(m(100).add(m(250)).minor).toBe(350);
    expect(m(100).subtract(m(250)).minor).toBe(-150);
    expect(m(12_345).times(3).minor).toBe(37_035);
  });

  it("refuses non-integers", () => {
    expect(() => m(1.5)).toThrow(RangeError);
    expect(() => m(100).times(1.5)).toThrow(RangeError);
  });

  it("sums a list", () => {
    expect(Money.sum([m(1), m(2), m(3)]).minor).toBe(6);
    expect(Money.sum([]).isZero()).toBe(true);
  });

  it("compares", () => {
    expect(m(5).greaterThan(m(4))).toBe(true);
    expect(m(4).lessThan(m(5))).toBe(true);
    expect(m(5).compare(m(5))).toBe(0);
    expect(m(3).min(m(7)).minor).toBe(3);
    expect(m(3).max(m(7)).minor).toBe(7);
  });
});

describe("Money.split (installments)", () => {
  it("splits equally with the remainder on the last part", () => {
    // ৳ 1,000 in 3 installments → ৳ 333.33 + ৳ 333.33 + ৳ 333.34
    const parts = Money.fromMinor(1_000_00).split(3).map((p) => p.minor);
    expect(parts).toEqual([333_33, 333_33, 333_34]);
  });

  it("always sums back to the original", () => {
    for (const total of [1, 7, 99, 100_000, 12_345_67]) {
      for (const n of [1, 2, 3, 6, 7, 12]) {
        const parts = Money.fromMinor(total).split(n);
        expect(parts).toHaveLength(n);
        expect(Money.sum(parts).minor).toBe(total);
      }
    }
  });

  it("rejects invalid part counts", () => {
    expect(() => Money.fromMinor(100).split(0)).toThrow(RangeError);
    expect(() => Money.fromMinor(100).split(1.5)).toThrow(RangeError);
  });
});
