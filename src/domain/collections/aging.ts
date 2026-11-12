import { ShopDate } from "../shared/shop-date";

export const AGING_BUCKETS = ["not_due", "d1_30", "d31_60", "d61_90", "d90_plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "not_due";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90_plus";
}

export type InstallmentStatus = "paid" | "overdue" | "due_today" | "upcoming";

/** Same rules as the installment_balances view (kept in sync by tests). */
export function installmentStatus(input: {
  amountMinor: number;
  paidMinor: number;
  dueDate: ShopDate;
  today: ShopDate;
}): { status: InstallmentStatus; remainingMinor: number; daysOverdue: number; partial: boolean } {
  const remainingMinor = Math.max(0, input.amountMinor - input.paidMinor);
  const partial = input.paidMinor > 0 && remainingMinor > 0;
  if (remainingMinor === 0) return { status: "paid", remainingMinor, daysOverdue: 0, partial: false };
  const days = input.today.daysSince(input.dueDate);
  if (days > 0) return { status: "overdue", remainingMinor, daysOverdue: days, partial };
  if (days === 0) return { status: "due_today", remainingMinor, daysOverdue: 0, partial };
  return { status: "upcoming", remainingMinor, daysOverdue: 0, partial };
}

/** Collections priority: bigger and older debts first (spec 6.5: amount × days overdue). */
export function collectionPriority(overdueMinor: number, maxDaysOverdue: number): number {
  return overdueMinor * Math.max(1, maxDaysOverdue);
}
