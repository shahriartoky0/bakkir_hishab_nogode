/**
 * Creates the single owner account. Public sign-up is disabled in the app; this
 * script builds a one-off auth instance that allows it.
 *
 *   npm run seed
 *
 * Reads OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME (optional) from .env.local / .env.
 * Safe to re-run: does nothing if the owner already exists.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim() || "Owner";
  if (!email || !password) throw new Error("Set OWNER_EMAIL and OWNER_PASSWORD (see .env.example).");
  if (password.length < 8) throw new Error("OWNER_PASSWORD must be at least 8 characters.");

  // Imported after dotenv so env validation sees the values.
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("../src/infrastructure/db/client");
  const { users } = await import("../src/infrastructure/db/schema");
  const { createAuth } = await import("../src/infrastructure/auth/auth");

  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    console.log(`Owner ${email} already exists — nothing to do.`);
    return;
  }

  const auth = createAuth(db, { allowSignUp: true, outsideNext: true });
  await auth.api.signUpEmail({ body: { email, password, name } });
  console.log(`Created owner account ${email}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
