import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FileStorage, PresignUploadInput } from "@/application/ports/file-storage";

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Neon Object Storage requires path-style addressing. */
  forcePathStyle: boolean;
}

/**
 * Any S3-compatible private bucket (Neon Object Storage or Cloudflare R2).
 * Only short-lived presigned URLs ever leave the server.
 */
export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Newer SDKs add CRC32 checksum params by default; a browser PUT can't send
      // them, so only compute checksums when an operation requires one.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  createUploadUrl(input: PresignUploadInput): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
      // Sign type and length so the browser must upload exactly what was approved.
      signableHeaders: new Set(["content-type", "content-length"]),
    });
  }

  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.config.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /** One DeleteObject per key (works on every S3-compatible store), 8 at a time. */
  async deleteObjects(keys: readonly string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 8) {
      await Promise.all(keys.slice(i, i + 8).map((Key) => this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key }))));
    }
  }
}
