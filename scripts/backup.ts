/**
 * npm run backup — dumps the whole database to backups/baki-YYYY-MM-DD-HHmm.sql
 * using pg_dump over the DIRECT (unpooled) connection string.
 *
 *   npm run backup                 # plain SQL (restore with psql)
 *   npm run backup -- --custom     # pg_dump custom format .dump (restore with pg_restore)
 *
 * Needs pg_dump on PATH, the same major version as the Neon server (or newer).
 * Photos are not included; they stay in object storage.
 */
import { spawn } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

function stamp(d = new Date()): string {
  // Dhaka time, so the file name matches the shop's calendar day.
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}-${get("hour")}${get("minute")}`;
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("Set DATABASE_URL_UNPOOLED (the direct Neon connection string) in .env.local.");
  if (url.includes("-pooler")) throw new Error("DATABASE_URL_UNPOOLED points at the pooler; use the direct connection string for pg_dump.");

  const custom = process.argv.includes("--custom");
  const dir = join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `baki-${stamp()}.${custom ? "dump" : "sql"}`);

  const args = ["--no-owner", "--no-privileges", "--file", file, ...(custom ? ["--format=custom"] : []), "--dbname", url];
  console.log(`Backing up to ${file} …`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("pg_dump", args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", (e: NodeJS.ErrnoException) =>
      reject(e.code === "ENOENT" ? new Error("pg_dump not found. Install the PostgreSQL client tools (see README → Backups).") : e),
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}`))));
  });

  const kb = Math.round(statSync(file).size / 1024);
  console.log(`Done: ${file} (${kb} KB). Keep a copy somewhere safe (e.g. Google Drive).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
