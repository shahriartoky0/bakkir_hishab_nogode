import { domainError, DomainErrorCode, err, ok, ShopDate, type DomainError, type Result } from "@/domain/shared";
import type { Clock } from "../../ports/clock";
import type { FileStorage } from "../../ports/file-storage";
import type { ClearCounts, ClearRange, UnitOfWork } from "../../ports/repositories";

/** The owner must type this (the UI maps the Bangla word to it). */
export const CLEAR_CONFIRM_TOKEN = "DELETE";

export interface ClearInput {
  from: string;
  to: string;
  removeEmptyCustomers: boolean;
}

function validRange(input: ClearInput): Result<ClearRange, DomainError> {
  const from = ShopDate.parse(input.from);
  const to = ShopDate.parse(input.to);
  if (!from.ok || !to.ok) return err(domainError(DomainErrorCode.INVALID_DATE));
  // Any length is fine ("All time" included); only a reversed range is wrong.
  if (from.value.isAfter(to.value)) return err(domainError(DomainErrorCode.INVALID_RANGE));
  return ok({ from: from.value.iso, to: to.value.iso, removeEmptyCustomers: input.removeEmptyCustomers });
}

/**
 * Permanently delete everything dated in a range (sales by sale date, payments by
 * payment date, adjustments/follow-ups by creation date) plus linked records, so
 * balances stay consistent. The only hard delete in the app; logged in activity_log.
 */
export class ClearDateRange {
  constructor(private readonly deps: { uow: UnitOfWork; clock: Clock; storage: FileStorage }) {}

  preview(input: ClearInput): Promise<Result<ClearCounts, DomainError>> {
    const range = validRange(input);
    if (!range.ok) return Promise.resolve(range);
    return this.deps.uow.run(async (r) => ok((await r.eraser.plan(range.value)).counts));
  }

  backup(input: ClearInput): Promise<Result<Record<string, unknown[]>, DomainError>> {
    const range = validRange(input);
    if (!range.ok) return Promise.resolve(range);
    return this.deps.uow.run(async (r) => ok(await r.eraser.snapshot(await r.eraser.plan(range.value))));
  }

  async execute(input: ClearInput & { confirm: string }): Promise<Result<ClearCounts, DomainError>> {
    if (input.confirm !== CLEAR_CONFIRM_TOKEN) return err(domainError(DomainErrorCode.CONFIRM_REQUIRED));
    const range = validRange(input);
    if (!range.ok) return range;

    const result = await this.deps.uow.run(async (r) => {
      const plan = await r.eraser.plan(range.value);
      await r.eraser.erase(plan);
      await r.activity.log({
        action: "data.cleared",
        entity: "settings",
        entityId: null,
        summary: `${range.value.from} – ${range.value.to}`,
        after: { range: range.value, counts: plan.counts, at: this.deps.clock.now() },
      });
      return { counts: plan.counts, photoKeys: plan.photoKeys };
    });

    // Photos go after the database commit; a failure here only leaves orphaned files.
    if (result.photoKeys.length) {
      await this.deps.storage.deleteObjects(result.photoKeys).catch((e: unknown) => console.error("[clear] photo delete failed", e));
    }
    return ok(result.counts);
  }
}
