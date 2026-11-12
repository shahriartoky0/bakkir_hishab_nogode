import "server-only";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { dbEnv } from "../config/env";
import * as schema from "./schema";

/**
 * Neon over WebSockets (Pool), so we get real interactive transactions —
 * required for every write that touches money (spec 2, 3).
 * Runtime uses the pooled DATABASE_URL; migrations use DATABASE_URL_UNPOOLED.
 */
neonConfig.webSocketConstructor = ws;

export type Database = NeonDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __bakiDb?: Database; __bakiPool?: Pool };

export function getDb(): Database {
  if (!globalForDb.__bakiDb) {
    const pool = new Pool({ connectionString: dbEnv().DATABASE_URL, max: 5 });
    globalForDb.__bakiPool = pool;
    globalForDb.__bakiDb = drizzle({ client: pool, schema, casing: "snake_case" });
  }
  return globalForDb.__bakiDb;
}
