import { describe, expect, it } from "vitest";
import { agingBucket, collectionPriority, installmentStatus } from "@/domain/collections/aging";
import { creditUsagePercent, creditWarnings } from "@/domain/customer/credit";
import { promiseStatus } from "@/domain/followup/follow-up";
import { allocateOldestFirst, directionFor, validateCreditAmount } from "@/domain/payment/payment";
import { buildSchedule, scheduleWithUpfront } from "@/domain/sale/installment-plan";
import { canCancelSale, canEditSale, computeSaleTotals, type SaleItemDraft } from "@/domain/sale/sale";
import { ShopDate } from "@/domain/shared/shop-date";

const d = ShopDate.of;
const item = (over: Partial<SaleItemDraft> = {}): SaleItemDraft => ({
  categoryId: null,
  name: "Ring",
  quantity: 1,
  unitPriceMinor: 100_000_00,
  customFields: {},
  notes: null,
  photos: [{ fileKey: "a", thumbKey: "b" }],
  ...over,
});

describe("sale totals", () => {
  it("sums lines and applies discount", () => {
    const r = computeSaleTotals([item(), item({ quantity: 2, unitPriceMinor: 5_000_00 })], 1_000_00);
    expect(r).toEqual({ ok: true, value: { subtotalMinor: 110_000_00, discountMinor: 1_000_00, totalMinor: 109_000_00, lineTotals: [100_000_00, 10_000_00] } });
  });

  it("requires a photo, items, and a sane discount", () => {
    expect(computeSaleTotals([], 0).ok).toBe(false);
    const noPhoto = computeSaleTotals([item({ photos: [] })], 0);
    expect(!noPhoto.ok && noPhoto.error.code).toBe("PHOTO_REQUIRED");
    const big = computeSaleTotals([item()], 100_000_01);
    expect(!big.ok && big.error.code).toBe("DISCOUNT_TOO_LARGE");
  });

  it("edit/cancel rules", () => {
    expect(canEditSale({ status: "open" }, false)).toBe(true);
    expect(canEditSale({ status: "open" }, true)).toBe(false);
    expect(canCancelSale({ status: "open" }, true)).toBe(false);
    expect(canCancelSale({ status: "closed" }, false)).toBe(false);
  });
});

describe("installment plan generation", () => {
  const saleDate = d("2026-11-12");

  it("single due date", () => {
    expect(buildSchedule(50_000_00, { kind: "single", dueDate: "2026-12-12" }, saleDate)).toEqual({
      ok: true,
      value: [{ seq: 1, dueDate: "2026-12-12", amountMinor: 50_000_00 }],
    });
    expect(buildSchedule(1, { kind: "single", dueDate: "2026-11-11" }, saleDate).ok).toBe(false);
  });

  it("monthly equal split with remainder on the last", () => {
    const r = buildSchedule(1_000_00, { kind: "installments", count: 3, frequency: "monthly", firstDate: "2027-01-31" }, saleDate);
    expect(r).toEqual({
      ok: true,
      value: [
        { seq: 1, dueDate: "2027-01-31", amountMinor: 333_33 },
        { seq: 2, dueDate: "2027-02-28", amountMinor: 333_33 },
        { seq: 3, dueDate: "2027-03-31", amountMinor: 333_34 },
      ],
    });
  });

  it("weekly dates", () => {
    const r = buildSchedule(300, { kind: "installments", count: 3, frequency: "weekly", firstDate: "2026-11-19" }, saleDate);
    expect(r.ok && r.value.map((x) => x.dueDate)).toEqual(["2026-11-19", "2026-11-26", "2026-12-03"]);
  });

  it("edited amounts must sum exactly", () => {
    const plan = { kind: "installments" as const, count: 2, frequency: "monthly" as const, firstDate: "2026-12-01" };
    expect(buildSchedule(1000, { ...plan, amounts: [400, 600] }, saleDate).ok).toBe(true);
    const bad = buildSchedule(1000, { ...plan, amounts: [400, 500] }, saleDate);
    expect(!bad.ok && bad.error.code).toBe("SCHEDULE_MISMATCH");
    expect(buildSchedule(1000, { ...plan, amounts: [0, 1000] }, saleDate).ok).toBe(false);
  });

  it("upfront becomes installment #0 and the rest is financed", () => {
    const r = scheduleWithUpfront(10_000, 4_000, { kind: "single", dueDate: "2026-12-12" }, saleDate);
    expect(r).toEqual({
      ok: true,
      value: [
        { seq: 0, dueDate: "2026-11-12", amountMinor: 4_000 },
        { seq: 1, dueDate: "2026-12-12", amountMinor: 6_000 },
      ],
    });
    const full = scheduleWithUpfront(10_000, 10_000, { kind: "single", dueDate: "2026-12-12" }, saleDate);
    expect(full.ok && full.value).toEqual([{ seq: 0, dueDate: "2026-11-12", amountMinor: 10_000 }]);
    const tooMuch = scheduleWithUpfront(10_000, 10_001, { kind: "single", dueDate: "2026-12-12" }, saleDate);
    expect(!tooMuch.ok && tooMuch.error.code).toBe("UPFRONT_TOO_LARGE");
  });
});

describe("oldest-first allocation", () => {
  const open = [
    { id: "c", saleId: "s2", dueDate: "2026-12-01", seq: 1, remainingMinor: 500 },
    { id: "a", saleId: "s1", dueDate: "2026-10-01", seq: 1, remainingMinor: 300 },
    { id: "b", saleId: "s1", dueDate: "2026-11-01", seq: 2, remainingMinor: 300 },
  ];

  it("fills the oldest due first", () => {
    expect(allocateOldestFirst(700, open)).toEqual({
      allocations: [
        { installmentId: "a", amountMinor: 300 },
        { installmentId: "b", amountMinor: 300 },
        { installmentId: "c", amountMinor: 100 },
      ],
      leftoverMinor: 0,
    });
  });

  it("reports leftover when paying more than owed", () => {
    expect(allocateOldestFirst(1200, open).leftoverMinor).toBe(100);
  });

  it("rejects overpayment and non-positive amounts", () => {
    expect(validateCreditAmount(1100, 1100).ok).toBe(true);
    const over = validateCreditAmount(1101, 1100);
    expect(!over.ok && over.error.code).toBe("OVERPAYMENT");
    expect(validateCreditAmount(0, 1100).ok).toBe(false);
    const none = validateCreditAmount(10, 0);
    expect(!none.ok && none.error.code).toBe("NOTHING_DUE");
  });

  it("adjustment directions", () => {
    expect(directionFor("opening_balance")).toBe("debit");
    expect(directionFor("write_off")).toBe("credit");
    expect(directionFor("correction", "debit")).toBe("debit");
  });
});

describe("overdue, aging and promises", () => {
  const today = d("2026-11-12");

  it("installment status", () => {
    expect(installmentStatus({ amountMinor: 100, paidMinor: 100, dueDate: d("2026-10-01"), today }).status).toBe("paid");
    expect(installmentStatus({ amountMinor: 100, paidMinor: 40, dueDate: d("2026-10-13"), today })).toEqual({ status: "overdue", remainingMinor: 60, daysOverdue: 30, partial: true });
    expect(installmentStatus({ amountMinor: 100, paidMinor: 0, dueDate: today, today }).status).toBe("due_today");
    expect(installmentStatus({ amountMinor: 100, paidMinor: 0, dueDate: d("2026-11-20"), today }).status).toBe("upcoming");
  });

  it("aging buckets", () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91, 400].map(agingBucket)).toEqual([
      "not_due", "d1_30", "d1_30", "d31_60", "d31_60", "d61_90", "d61_90", "d90_plus", "d90_plus",
    ]);
    expect(collectionPriority(1000, 10)).toBeGreaterThan(collectionPriority(5000, 1));
  });

  it("promise status", () => {
    const base = { promisedDate: d("2026-11-10"), promisedAmountMinor: 5000, today };
    expect(promiseStatus({ ...base, paidTowardMinor: 5000 })).toBe("kept");
    expect(promiseStatus({ ...base, paidTowardMinor: 4999 })).toBe("broken");
    expect(promiseStatus({ ...base, promisedDate: today, paidTowardMinor: 0 })).toBe("pending");
    expect(promiseStatus({ ...base, promisedAmountMinor: null, paidTowardMinor: 1 })).toBe("kept");
  });

  it("credit warnings", () => {
    expect(creditWarnings({ isBlocked: true, creditLimitMinor: 1000, currentBalanceMinor: 900, newCreditMinor: 200 })).toEqual(["BLOCKED", "OVER_LIMIT"]);
    expect(creditWarnings({ isBlocked: false, creditLimitMinor: null, currentBalanceMinor: 9e9, newCreditMinor: 1 })).toEqual([]);
    expect(creditUsagePercent(500, 1000)).toBe(50);
    expect(creditUsagePercent(500, null)).toBeNull();
  });
});
