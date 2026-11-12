import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APP_NAME } from "@/domain/shared/app";
import { authEnv } from "../config/env";
import type { Database } from "../db/client";
import { accounts, sessions, users, verifications } from "../db/schema";
import { newId } from "../ids";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Better Auth: email + password only, public sign-up disabled.
 * The seed script builds an instance with `allowSignUp: true` once, to create the owner.
 */
export function createAuth(db: Database, opts: { allowSignUp?: boolean; outsideNext?: boolean } = {}) {
  const env = authEnv();
  return betterAuth({
    appName: APP_NAME,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !opts.allowSignUp,
      minPasswordLength: 8,
    },
    user: {
      additionalFields: {
        locale: { type: "string", required: false, defaultValue: "bn", input: false },
      },
    },
    session: {
      expiresIn: SESSION_TTL_SECONDS,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      database: { generateId: () => newId() },
    },
    // nextCookies must be the last plugin so server actions can set cookies.
    // Scripts (seed) run outside a Next request and skip it.
    plugins: opts.outsideNext ? [] : [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
