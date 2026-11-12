import { describe, expect, it } from "vitest";
import { ShopDate } from "@/domain/shared/shop-date";

describe("ShopDate", () => {
  it("parses valid ISO dates and rejects invalid ones", () => {
    expect(ShopDate.parse("2026-11-12").ok).toBe(true);
    expect(ShopDate.parse("2028-02-29").ok).toBe(true); // leap year
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "26-11-12", "2026/11/12", ""]) {
      expect(ShopDate.parse(bad).ok, bad).toBe(false);
    }
  });

  it("uses the Asia/Dhaka calendar day, not UTC", () => {
    // 2026-11-11 19:30 UTC is already 01:30 on the 12th in Dhaka (UTC+6)
    expect(ShopDate.fromInstant(new Date("2026-11-11T19:30:00Z")).iso).toBe("2026-11-12");
    // 2026-11-11 17:59 UTC is 23:59 on the 11th in Dhaka
    expect(ShopDate.fromInstant(new Date("2026-11-11T17:59:00Z")).iso).toBe("2026-11-11");
  });

  it("adds days across month and year boundaries", () => {
    expect(ShopDate.of("2026-12-25").addDays(7).iso).toBe("2027-01-01");
    expect(ShopDate.of("2026-03-01").addDays(-1).iso).toBe("2026-02-28");
    expect(ShopDate.of("2026-11-12").addDays(90).iso).toBe("2027-02-10");
  });

  it("adds months, clamping to the month end", () => {
    expect(ShopDate.of("2026-01-31").addMonths(1).iso).toBe("2026-02-28");
    expect(ShopDate.of("2028-01-31").addMonths(1).iso).toBe("2028-02-29");
    expect(ShopDate.of("2026-11-15").addMonths(3).iso).toBe("2027-02-15");
    expect(ShopDate.of("2026-05-31").addMonths(-1).iso).toBe("2026-04-30");
  });

  it("counts days between dates", () => {
    const due = ShopDate.of("2026-10-01");
    const today = ShopDate.of("2026-11-12");
    expect(today.daysSince(due)).toBe(42);
    expect(due.daysSince(today)).toBe(-42);
    expect(today.isAfter(due)).toBe(true);
    expect(due.isBefore(today)).toBe(true);
    expect(today.compare(ShopDate.of("2026-11-12"))).toBe(0);
  });
});
