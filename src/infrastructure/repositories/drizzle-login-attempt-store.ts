import { and, count, eq, gte, lt } from "drizzle-orm";
import type { LoginAttemptStore } from "@/application/ports/authenticator";
import type { Database } from "../db/client";
import { loginAttempts } from "../db/schema";

export class DrizzleLoginAttemptStore implements LoginAttemptStore {
  constructor(private readonly db: Database) {}

  async countFailuresSince(key: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.key, key), gte(loginAttempts.attemptedAt, since)));
    return row?.n ?? 0;
  }

  async recordFailure(key: string, at: Date): Promise<void> {
    await this.db.insert(loginAttempts).values({ key, attemptedAt: at });
    // Opportunistic cleanup: drop anything older than a day.
    await this.db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, new Date(at.getTime() - 86_400_000)));
  }

  async clearFailures(key: string): Promise<void> {
    await this.db.delete(loginAttempts).where(eq(loginAttempts.key, key));
  }
}
