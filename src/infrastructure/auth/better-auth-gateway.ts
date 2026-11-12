import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import type { AccountGateway, AuthenticatedUser, Authenticator } from "@/application/ports/authenticator";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import type { Auth } from "./auth";

type HeadersProvider = () => Promise<Headers>;

/**
 * Adapter between our ports and Better Auth. Request headers are supplied by the
 * composition root (from next/headers), so infrastructure stays framework-light.
 */
export class BetterAuthGateway implements Authenticator, AccountGateway {
  constructor(
    private readonly auth: Auth,
    private readonly db: Database,
    private readonly headers: HeadersProvider,
  ) {}

  async signIn(email: string, password: string): Promise<AuthenticatedUser | null> {
    try {
      const res = await this.auth.api.signInEmail({
        body: { email, password, rememberMe: true },
        headers: await this.headers(),
      });
      return this.findUser(res.user.id);
    } catch (e) {
      // Only a genuine bad-credentials answer counts as a failed attempt; anything
      // else (origin check, misconfiguration) is a real error and must surface.
      if (isAPIError(e) && e.status === "UNAUTHORIZED") return null;
      console.error("[auth] sign-in failed unexpectedly", e);
      throw e;
    }
  }

  async currentUser(): Promise<AuthenticatedUser | null> {
    const session = await this.auth.api.getSession({ headers: await this.headers() });
    if (!session) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      locale: (session.user as { locale?: string }).locale ?? "bn",
    };
  }

  async signOut(): Promise<void> {
    await this.auth.api.signOut({ headers: await this.headers() });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      await this.auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: await this.headers(),
      });
      return true;
    } catch (e) {
      if (isAPIError(e) && (e.status === "BAD_REQUEST" || e.status === "UNAUTHORIZED")) return false;
      throw e;
    }
  }

  async signOutEverywhere(): Promise<void> {
    const headers = await this.headers();
    await this.auth.api.revokeSessions({ headers });
    await this.auth.api.signOut({ headers }).catch(() => undefined);
  }

  async setLocale(userId: string, locale: string): Promise<void> {
    await this.db.update(users).set({ locale }).where(eq(users.id, userId));
  }

  private async findUser(id: string): Promise<AuthenticatedUser | null> {
    const [u] = await this.db
      .select({ id: users.id, email: users.email, name: users.name, locale: users.locale })
      .from(users)
      .where(eq(users.id, id));
    return u ?? null;
  }
}
