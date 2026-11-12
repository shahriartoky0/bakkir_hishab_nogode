import { describe, expect, it } from "vitest";
import { ShopDate } from "@/domain/shared/shop-date";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPhone, type FormatPrefs } from "@/presentation/lib/format";

const bn: FormatPrefs = { locale: "bn", banglaDigits: true };
const bnLatin: FormatPrefs = { locale: "bn", banglaDigits: false };
const en: FormatPrefs = { locale: "en", banglaDigits: true };

describe("formatMoney (lakh/crore grouping)", () => {
  it("formats in Bangla digits", () => {
    expect(formatMoney(12_500_000, bn)).toBe("৳ ১,২৫,০০০");
  });

  it("formats in Latin digits when Bangla digits are off or UI is English", () => {
    expect(formatMoney(12_500_000, bnLatin)).toBe("৳ 1,25,000");
    expect(formatMoney(12_500_000, en)).toBe("৳ 1,25,000");
  });

  it("uses crore grouping for large amounts", () => {
    expect(formatMoney(1_234_567_800, en)).toBe("৳ 1,23,45,678");
  });

  it("shows paisa only when present (or forced)", () => {
    expect(formatMoney(125_050, en)).toBe("৳ 1,250.50");
    expect(formatMoney(125_000, en, { alwaysShowPaisa: true })).toBe("৳ 1,250.00");
    expect(formatMoney(125_050, bn)).toBe("৳ ১,২৫০.৫০");
  });

  it("formats zero and negatives", () => {
    expect(formatMoney(0, en)).toBe("৳ 0");
    expect(formatMoney(-50_000, en)).toBe("-৳ 500");
  });
});

describe("formatNumber", () => {
  it("groups and localizes digits", () => {
    expect(formatNumber(125000, bn)).toBe("১,২৫,০০০");
    expect(formatNumber(4.665, en)).toBe("4.665");
    expect(formatNumber(4.665, bn)).toBe("৪.৬৬৫");
  });
});

describe("formatDate", () => {
  const d = ShopDate.of("2026-11-12");

  it("uses Bangla month names and digits", () => {
    expect(formatDate(d, bn, "long")).toBe("১২ নভেম্বর ২০২৬");
  });

  it("uses English month names", () => {
    expect(formatDate(d, en, "long")).toBe("12 November 2026");
    expect(formatDate(d, en, "medium")).toBe("12 Nov 2026");
    expect(formatDate(d, en, "short")).toBe("12/11/2026");
  });

  it("keeps Bangla month names but Latin digits when digits are off", () => {
    expect(formatDate(d, bnLatin, "long")).toBe("12 নভেম্বর 2026");
  });

  it("accepts ISO strings and instants (shown in Dhaka time)", () => {
    expect(formatDate("2026-11-12", en, "long")).toBe("12 November 2026");
    expect(formatDate(new Date("2026-11-11T19:30:00Z"), en, "long")).toBe("12 November 2026");
  });

  it("formats date-time in shop time", () => {
    expect(formatDateTime(new Date("2026-11-12T09:05:00Z"), en)).toBe("12 Nov 2026, 3:05 PM");
  });
});

describe("formatPhone", () => {
  it("shows the national form with localized digits", () => {
    expect(formatPhone("+8801712345678", en)).toBe("01712-345678");
    expect(formatPhone("+8801712345678", bn)).toBe("০১৭১২-৩৪৫৬৭৮");
  });
});
