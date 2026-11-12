/**
 * npm run storage:setup [-- extra-origin ...]
 *
 * 1. Applies the CORS rule browsers need for direct presigned uploads
 *    (origins: BETTER_AUTH_URL, http://localhost:3000, plus any extra args).
 * 2. Round-trips a tiny test object through presigned PUT and GET URLs, then deletes it.
 *
 * Works with Neon Object Storage or R2, whichever the env configures.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { DeleteObjectCommand, GetBucketCorsCommand, PutBucketCorsCommand, S3Client } = await import(
    "@aws-sdk/client-s3"
  );
  const { storageEnv } = await import("../src/infrastructure/config/env");
  const { S3FileStorage } = await import("../src/infrastructure/storage/s3-file-storage");

  const env = storageEnv();
  console.log(`Provider: ${env.provider} · bucket: ${env.bucket} · endpoint: ${env.endpoint}`);

  const client = new S3Client({
    region: env.region,
    endpoint: env.endpoint,
    forcePathStyle: env.forcePathStyle,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  const origins = [
    ...new Set(
      [process.env.BETTER_AUTH_URL, "http://localhost:3000", ...process.argv.slice(2)]
        .filter((o): o is string => !!o)
        .map((o) => o.replace(/\/$/, "")),
    ),
  ];
  await client.send(
    new PutBucketCorsCommand({
      Bucket: env.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["PUT", "GET"],
            AllowedHeaders: ["content-type"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  const cors = await client.send(new GetBucketCorsCommand({ Bucket: env.bucket }));
  console.log("CORS origins:", cors.CORSRules?.[0]?.AllowedOrigins?.join(", "));

  // Round-trip through presigned URLs, exactly like the browser does.
  const storage = new S3FileStorage(env);
  const key = `item/0000-00/storage-setup-check.jpg`;
  const body = new TextEncoder().encode("baki storage check");
  const putUrl = await storage.createUploadUrl({
    key,
    contentType: "image/jpeg",
    contentLength: body.byteLength,
    expiresInSeconds: 60,
  });
  const put = await fetch(putUrl, {
    method: "PUT",
    body,
    headers: { "Content-Type": "image/jpeg", Origin: origins[0] ?? "http://localhost:3000" },
  });
  if (!put.ok) throw new Error(`Presigned PUT failed: ${put.status} ${await put.text()}`);

  const get = await fetch(await storage.createDownloadUrl(key, 60));
  const text = await get.text();
  if (!get.ok || text !== "baki storage check") throw new Error(`Presigned GET failed: ${get.status} ${text}`);

  await client.send(new DeleteObjectCommand({ Bucket: env.bucket, Key: key }));
  console.log("✓ Presigned upload and download work. Photo storage is ready.");
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exit(1);
  });
