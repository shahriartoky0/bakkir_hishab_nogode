import { ShopDate } from "../shared/shop-date";

export const FOLLOW_UP_CHANNELS = ["call", "whatsapp", "visit", "in_shop"] as const;
export type FollowUpChannel = (typeof FOLLOW_UP_CHANNELS)[number];

export const FOLLOW_UP_OUTCOMES = ["reached", "no_answer", "promised", "refused"] as const;
export type FollowUpOutcome = (typeof FOLLOW_UP_OUTCOMES)[number];

export type PromiseStatus = "pending" | "kept" | "broken";

/**
 * A promise is KEPT when payments received from when it was made up to the end of
 * the promised day reach the promised amount (or any payment when no amount was
 * given); BROKEN once the promised day has passed without that; otherwise PENDING.
 */
export function promiseStatus(input: {
  promisedDate: ShopDate;
  promisedAmountMinor: number | null;
  /** Sum of active payments from the promise's creation up to the promised date (inclusive). */
  paidTowardMinor: number;
  today: ShopDate;
}): PromiseStatus {
  const target = input.promisedAmountMinor ?? 1;
  if (input.paidTowardMinor >= target) return "kept";
  return input.today.isAfter(input.promisedDate) ? "broken" : "pending";
}
