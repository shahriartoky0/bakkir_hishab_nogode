export interface PresignUploadInput {
  key: string;
  contentType: string;
  /** Exact byte size; it is signed into the URL so the client can't upload more. */
  contentLength: number;
  expiresInSeconds: number;
}

/** Private object storage (Cloudflare R2). Only short-lived presigned URLs leave the server. */
export interface FileStorage {
  createUploadUrl(input: PresignUploadInput): Promise<string>;
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Permanently remove objects (used only by "clear data"). Missing keys are ignored. */
  deleteObjects(keys: readonly string[]): Promise<void>;
}
