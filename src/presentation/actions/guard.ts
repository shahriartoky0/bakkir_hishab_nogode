import "server-only";
import type { z } from "zod";
import type { DomainError } from "@/domain/shared/domain-error";
import type { Result } from "@/domain/shared/result";
import { getCurrentUser } from "../auth/session";
import { actionErr, actionOk, type ActionResult } from "./result";

/**
 * The shape of every server action (spec 3): check session → validate with zod →
 * call one use case → return a serializable result. Unexpected exceptions are
 * logged and returned as UNKNOWN (never leaked to the client).
 */
export async function guarded<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  run: (data: z.output<S>) => Promise<Result<T, DomainError>>,
): Promise<ActionResult<T>> {
  if (!(await getCurrentUser())) return actionErr("UNAUTHORIZED");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return actionErr("VALIDATION");
  try {
    const r = await run(parsed.data);
    return r.ok ? actionOk(r.value) : actionErr(r.error);
  } catch (e) {
    console.error("[action] failed", e);
    return actionErr("UNKNOWN");
  }
}

/**
 * Idempotent writes (create sale, receive payment): when two identical requests race,
 * the loser hits the unique idempotency_key and its transaction aborts. Retrying once
 * finds the record the winner created and returns it.
 */
export async function retryOnce<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    return run();
  }
}

/** For read actions: session check + validation, returns data directly. */
export async function guardedRead<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  run: (data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  if (!(await getCurrentUser())) return actionErr("UNAUTHORIZED");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return actionErr("VALIDATION");
  try {
    return actionOk(await run(parsed.data));
  } catch (e) {
    console.error("[action] read failed", e);
    return actionErr("UNKNOWN");
  }
}
