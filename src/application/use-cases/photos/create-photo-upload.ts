import { domainError, DomainErrorCode, err, ok, type DomainError, type Result } from "@/domain/shared";
import type { Clock } from "../../ports/clock";
import type { FileStorage } from "../../ports/file-storage";
import type { IdGenerator } from "../../ports/id-generator";

export const PHOTO_PURPOSES = ["customer", "item", "logo"] as const;
export type PhotoPurpose = (typeof PHOTO_PURPOSES)[number];

/** MIME allow-list → file extension. */
export const ALLOWED_PHOTO_TYPES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/png": "png",
};

/** Client compresses to ~300 KB / ~30 KB; these caps leave headroom but stop abuse. */
export const MAX_DISPLAY_BYTES = 2 * 1024 * 1024;
export const MAX_THUMB_BYTES = 256 * 1024;
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;

export interface CreatePhotoUploadInput {
  purpose: PhotoPurpose;
  contentType: string;
  displaySize: number;
  thumbSize: number;
}

export interface PresignedPhotoUpload {
  fileKey: string;
  thumbKey: string;
  displayUploadUrl: string;
  thumbUploadUrl: string;
  contentType: string;
}

/** Validates type/size and presigns PUT URLs for the display image and its thumbnail. */
export class CreatePhotoUpload {
  constructor(
    private readonly deps: { storage: FileStorage; ids: IdGenerator; clock: Clock },
  ) {}

  async execute(input: CreatePhotoUploadInput): Promise<Result<PresignedPhotoUpload, DomainError>> {
    const ext = ALLOWED_PHOTO_TYPES[input.contentType];
    if (!ext) return err(domainError(DomainErrorCode.UNSUPPORTED_FILE_TYPE));

    const sizesValid =
      Number.isInteger(input.displaySize) &&
      Number.isInteger(input.thumbSize) &&
      input.displaySize > 0 &&
      input.thumbSize > 0;
    if (!sizesValid) return err(domainError(DomainErrorCode.VALIDATION));
    if (input.displaySize > MAX_DISPLAY_BYTES || input.thumbSize > MAX_THUMB_BYTES) {
      return err(domainError(DomainErrorCode.FILE_TOO_LARGE));
    }

    const month = this.deps.clock.now().toISOString().slice(0, 7); // YYYY-MM
    const id = this.deps.ids.next();
    const fileKey = `${input.purpose}/${month}/${id}.${ext}`;
    const thumbKey = `${input.purpose}/${month}/${id}_thumb.${ext}`;

    const [displayUploadUrl, thumbUploadUrl] = await Promise.all([
      this.deps.storage.createUploadUrl({
        key: fileKey,
        contentType: input.contentType,
        contentLength: input.displaySize,
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      }),
      this.deps.storage.createUploadUrl({
        key: thumbKey,
        contentType: input.contentType,
        contentLength: input.thumbSize,
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      }),
    ]);

    return ok({ fileKey, thumbKey, displayUploadUrl, thumbUploadUrl, contentType: input.contentType });
  }
}
