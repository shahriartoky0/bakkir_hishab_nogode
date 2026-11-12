import "server-only";
import { z } from "zod";

/**
 * Server env, validated lazily per concern so a missing R2 key doesn't stop
 * login from working (and `next build` doesn't need runtime secrets).
 */
function lazy<T>(read: () => T): () => T {
  let cached: T | undefined;
  return () => (cached ??= read());
}

const dbSchema = z.object({
  DATABASE_URL: z.url(),
});

const authSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
});

const r2Schema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

const neonStorageSchema = z.object({
  endpoint: z.url(),
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucket: z.string().min(1),
});

function parse<S extends z.ZodType>(schema: S, group: string): z.infer<S> {
  const r = schema.safeParse(process.env);
  if (!r.success) {
    const missing = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid ${group} environment variables: ${missing}. See README.`);
  }
  return r.data;
}

export const dbEnv = lazy(() => parse(dbSchema, "database"));
export const authEnv = lazy(() => parse(authSchema, "auth"));
export interface StorageEnv {
  provider: "neon" | "r2";
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

/**
 * Photo storage: Cloudflare R2 when R2_ACCOUNT_ID is set, otherwise Neon Object
 * Storage. For Neon, STORAGE_* names win over the AWS_* names `neon deploy`
 * writes locally — Vercel reserves AWS_* names, so production uses STORAGE_*.
 */
export const storageEnv = lazy((): StorageEnv => {
  const e = process.env;
  if (e.R2_ACCOUNT_ID) {
    const r2 = parse(r2Schema, "R2");
    return {
      provider: "r2",
      endpoint: `https://${r2.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: "auto",
      accessKeyId: r2.R2_ACCESS_KEY_ID,
      secretAccessKey: r2.R2_SECRET_ACCESS_KEY,
      bucket: r2.R2_BUCKET,
      forcePathStyle: false,
    };
  }
  const r = neonStorageSchema.safeParse({
    endpoint: e.STORAGE_ENDPOINT || e.AWS_ENDPOINT_URL_S3,
    region: e.STORAGE_REGION || e.AWS_REGION,
    accessKeyId: e.STORAGE_ACCESS_KEY_ID || e.AWS_ACCESS_KEY_ID,
    secretAccessKey: e.STORAGE_SECRET_ACCESS_KEY || e.AWS_SECRET_ACCESS_KEY,
    bucket: e.STORAGE_BUCKET || "baki-photos",
  });
  if (!r.success) {
    const missing = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Photo storage is not configured (missing: ${missing}). See README "Photo storage".`);
  }
  return { provider: "neon", ...r.data, forcePathStyle: true };
});
