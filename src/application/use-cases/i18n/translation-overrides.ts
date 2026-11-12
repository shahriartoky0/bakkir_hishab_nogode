import { domainError, DomainErrorCode, err, ok, type DomainError, type Result } from "@/domain/shared";
import type { Locale } from "../../ports/records";
import type { UnitOfWork } from "../../ports/repositories";

/** Change (or reset, with value = null) the wording of one UI message (spec 4.3). */
export class SetTranslationOverride {
  constructor(private readonly deps: { uow: UnitOfWork; knownKeys: () => ReadonlySet<string> }) {}

  execute(input: { locale: Locale; key: string; value: string | null }): Promise<Result<null, DomainError>> {
    return this.deps.uow.run(async (r) => {
      if (!this.deps.knownKeys().has(input.key)) return err(domainError(DomainErrorCode.NOT_FOUND));
      const value = input.value?.trim();
      if (value) {
        await r.translations.set(input.locale, input.key, value.slice(0, 1000));
      } else {
        await r.translations.remove(input.locale, input.key);
      }
      await r.activity.log({
        action: value ? "translation.set" : "translation.reset",
        entity: "translation",
        entityId: null,
        summary: `${input.locale}:${input.key}`,
        after: value ? { value } : null,
      });
      return ok(null);
    });
  }
}
