import {
  FOLLOW_UP_CHANNELS,
  FOLLOW_UP_OUTCOMES,
  type FollowUpChannel,
  type FollowUpOutcome,
} from "@/domain/followup/follow-up";
import { domainError, DomainErrorCode, err, ok, ShopDate, type DomainError, type Result } from "@/domain/shared";
import type { Clock } from "../../ports/clock";
import type { UnitOfWork } from "../../ports/repositories";
import { todayIn } from "../shared";

export interface LogFollowUpInput {
  customerId: string;
  saleId?: string | null;
  channel: FollowUpChannel;
  outcome: FollowUpOutcome;
  note?: string | null;
  promisedAmountMinor?: number | null;
  promisedDate?: string | null;
}

export class LogFollowUp {
  constructor(private readonly deps: { uow: UnitOfWork; clock: Clock }) {}

  execute(input: LogFollowUpInput): Promise<Result<{ id: string }, DomainError>> {
    return this.deps.uow.run(async (r) => {
      if (!FOLLOW_UP_CHANNELS.includes(input.channel) || !FOLLOW_UP_OUTCOMES.includes(input.outcome)) {
        return err(domainError(DomainErrorCode.VALIDATION));
      }
      const customer = await r.customers.getById(input.customerId);
      if (!customer) return err(domainError(DomainErrorCode.NOT_FOUND));

      let promisedDate: string | null = null;
      let promisedAmountMinor: number | null = null;
      if (input.outcome === "promised") {
        const d = ShopDate.parse(input.promisedDate ?? "");
        if (!d.ok || d.value.isBefore(todayIn(this.deps.clock))) return err(domainError(DomainErrorCode.INVALID_DATE));
        promisedDate = d.value.iso;
        if (input.promisedAmountMinor != null) {
          if (!Number.isSafeInteger(input.promisedAmountMinor) || input.promisedAmountMinor <= 0) {
            return err(domainError(DomainErrorCode.INVALID_AMOUNT));
          }
          promisedAmountMinor = input.promisedAmountMinor;
        }
      }

      const f = await r.followUps.insert({
        customerId: customer.id,
        saleId: input.saleId ?? null,
        channel: input.channel,
        outcome: input.outcome,
        note: input.note?.trim().slice(0, 1000) || null,
        promisedAmountMinor,
        promisedDate,
      });
      await r.activity.log({ action: "followup.logged", entity: "follow_up", entityId: f.id, summary: customer.name, after: f });
      return ok({ id: f.id });
    });
  }
}
