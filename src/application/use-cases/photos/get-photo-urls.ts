import type { FileStorage } from "../../ports/file-storage";
import { PHOTO_PURPOSES } from "./create-photo-upload";

export const DOWNLOAD_URL_TTL_SECONDS = 10 * 60;

const KEY_RE = new RegExp(
  `^(${PHOTO_PURPOSES.join("|")})/\\d{4}-\\d{2}/[0-9a-f-]{36}(_thumb)?\\.(jpg|webp|png)$`,
);

export function isValidPhotoKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Short-lived presigned GET URLs for private photos. Unknown-format keys are skipped. */
export class GetPhotoUrls {
  constructor(private readonly deps: { storage: FileStorage }) {}

  async execute(keys: readonly string[]): Promise<Record<string, string>> {
    const valid = [...new Set(keys)].filter(isValidPhotoKey);
    const entries = await Promise.all(
      valid.map(async (k) => [k, await this.deps.storage.createDownloadUrl(k, DOWNLOAD_URL_TTL_SECONDS)] as const),
    );
    return Object.fromEntries(entries);
  }
}
