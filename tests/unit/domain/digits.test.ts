import { describe, expect, it } from "vitest";
import { toBanglaDigits, toLatinDigits } from "@/domain/shared/digits";

describe("Bangla digit conversion", () => {
  it("converts Bangla digits to Latin", () => {
    expect(toLatinDigits("০১২৩৪৫৬৭৮৯")).toBe("0123456789");
    expect(toLatinDigits("৳ ১,২৫,০০০.৫০")).toBe("৳ 1,25,000.50");
  });

  it("leaves Latin digits and other text untouched", () => {
    expect(toLatinDigits("01712-345678")).toBe("01712-345678");
    expect(toLatinDigits("রহিম")).toBe("রহিম");
  });

  it("handles mixed Bangla and Latin digits", () => {
    expect(toLatinDigits("০১7১২")).toBe("01712");
  });

  it("converts Latin digits to Bangla", () => {
    expect(toBanglaDigits("12 November 2026")).toBe("১২ November ২০২৬");
  });

  it("round-trips", () => {
    expect(toLatinDigits(toBanglaDigits("9876543210"))).toBe("9876543210");
  });
});
