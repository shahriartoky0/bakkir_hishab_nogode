import { domainError, DomainErrorCode, err, ok, type DomainError, type Result } from "@/domain/shared";
import type { SettingsRecord } from "../../ports/records";
import type { UnitOfWork } from "../../ports/repositories";

export type SettingsPatch = Partial<Omit<SettingsRecord, "starterSetDecidedAt">>;

export const SETTINGS_LIMITS = {
  creditDays: { min: 0, max: 365 },
  autoLogoutMinutes: { min: 5, max: 240 },
  prefixMaxLength: 10,
} as const;

const PREFIX_RE = /^[A-Za-z0-9\-/_]{1,10}$/;
const trimOrNull = (s: string | null | undefined, max = 500) => (s?.trim() ? s.trim().slice(0, max) : null);

/** Normalize and check a settings patch; unknown/invalid values are rejected, not clamped. */
export function validateSettingsPatch(patch: SettingsPatch): Result<SettingsPatch, DomainError> {
  const out: SettingsPatch = { ...patch };
  const invalid = (field: string) => err(domainError(DomainErrorCode.VALIDATION, { field }));

  for (const k of ["shopNameBn", "shopNameEn", "addressBn", "addressEn", "receiptFooterBn", "receiptFooterEn", "phone", "logoKey"] as const) {
    if (k in patch) out[k] = trimOrNull(patch[k]);
  }
  if (patch.defaultLocale !== undefined && patch.defaultLocale !== "bn" && patch.defaultLocale !== "en") return invalid("defaultLocale");
  if (patch.defaultCreditDays !== undefined) {
    const d = patch.defaultCreditDays;
    if (!Number.isInteger(d) || d < SETTINGS_LIMITS.creditDays.min || d > SETTINGS_LIMITS.creditDays.max) return invalid("defaultCreditDays");
  }
  if (patch.autoLogoutMinutes !== undefined) {
    const m = patch.autoLogoutMinutes;
    if (!Number.isInteger(m) || m < SETTINGS_LIMITS.autoLogoutMinutes.min || m > SETTINGS_LIMITS.autoLogoutMinutes.max) {
      return invalid("autoLogoutMinutes");
    }
  }
  for (const k of ["salePrefix", "receiptPrefix"] as const) {
    if (patch[k] !== undefined) {
      const v = patch[k]!.trim();
      if (!PREFIX_RE.test(v)) return invalid(k);
      out[k] = v;
    }
  }
  if (patch.useBanglaDigits !== undefined && typeof patch.useBanglaDigits !== "boolean") return invalid("useBanglaDigits");
  return ok(out);
}

export class UpdateSettings {
  constructor(private readonly deps: { uow: UnitOfWork }) {}

  execute(patch: SettingsPatch): Promise<Result<SettingsRecord, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const valid = validateSettingsPatch(patch);
      if (!valid.ok) return valid;
      const before = await r.settings.get();
      const after = await r.settings.update(valid.value);
      await r.activity.log({ action: "settings.updated", entity: "settings", entityId: null, summary: "settings", before, after });
      return ok(after);
    });
  }
}
