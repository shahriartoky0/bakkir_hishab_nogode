import type { DomainError } from "@/domain/shared/domain-error";

/** What every server action returns: serializable, with an error *code* (never text). */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; code: string; details?: Record<string, string | number | boolean | null> };

export const actionOk = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export function actionErr(error: DomainError<string> | string): { ok: false; code: string; details?: Record<string, string | number | boolean | null> } {
  if (typeof error === "string") return { ok: false, code: error };
  return error.details ? { ok: false, code: error.code, details: { ...error.details } } : { ok: false, code: error.code };
}
