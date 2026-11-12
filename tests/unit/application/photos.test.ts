import { beforeEach, describe, expect, it } from "vitest";
import {
  CreatePhotoUpload,
  MAX_DISPLAY_BYTES,
  MAX_THUMB_BYTES,
  UPLOAD_URL_TTL_SECONDS,
} from "@/application/use-cases/photos/create-photo-upload";
import { GetPhotoUrls, isValidPhotoKey } from "@/application/use-cases/photos/get-photo-urls";
import { FakeClock, FakeFileStorage, SequentialIds } from "../../fakes";

describe("CreatePhotoUpload", () => {
  let storage: FakeFileStorage;
  let useCase: CreatePhotoUpload;

  beforeEach(() => {
    storage = new FakeFileStorage();
    useCase = new CreatePhotoUpload({ storage, ids: new SequentialIds(), clock: new FakeClock() });
  });

  it("presigns display and thumbnail with signed size and type", async () => {
    const r = await useCase.execute({ purpose: "item", contentType: "image/jpeg", displaySize: 300_000, thumbSize: 30_000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fileKey).toBe("item/2026-11/00000000-0000-7000-8000-000000000001.jpg");
    expect(r.value.thumbKey).toBe("item/2026-11/00000000-0000-7000-8000-000000000001_thumb.jpg");
    expect(storage.uploads).toEqual([
      { key: r.value.fileKey, contentType: "image/jpeg", contentLength: 300_000, expiresInSeconds: UPLOAD_URL_TTL_SECONDS },
      { key: r.value.thumbKey, contentType: "image/jpeg", contentLength: 30_000, expiresInSeconds: UPLOAD_URL_TTL_SECONDS },
    ]);
    expect(isValidPhotoKey(r.value.fileKey)).toBe(true);
    expect(isValidPhotoKey(r.value.thumbKey)).toBe(true);
  });

  it.each(["image/gif", "application/pdf", "image/svg+xml", "text/html"])("rejects MIME %s", async (contentType) => {
    const r = await useCase.execute({ purpose: "item", contentType, displaySize: 1000, thumbSize: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(storage.uploads).toHaveLength(0);
  });

  it("rejects oversized files", async () => {
    const big = await useCase.execute({ purpose: "customer", contentType: "image/webp", displaySize: MAX_DISPLAY_BYTES + 1, thumbSize: 100 });
    const bigThumb = await useCase.execute({ purpose: "customer", contentType: "image/webp", displaySize: 100, thumbSize: MAX_THUMB_BYTES + 1 });
    expect(!big.ok && big.error.code).toBe("FILE_TOO_LARGE");
    expect(!bigThumb.ok && bigThumb.error.code).toBe("FILE_TOO_LARGE");
  });

  it("rejects zero or fractional sizes", async () => {
    const r = await useCase.execute({ purpose: "item", contentType: "image/png", displaySize: 0, thumbSize: 1.5 });
    expect(!r.ok && r.error.code).toBe("VALIDATION");
  });
});

describe("GetPhotoUrls", () => {
  it("presigns only well-formed keys, deduplicated", async () => {
    const storage = new FakeFileStorage();
    const key = "item/2026-11/0196f3a2-1111-7000-8000-000000000001.jpg";
    const urls = await new GetPhotoUrls({ storage }).execute([key, key, "../etc/passwd", "item/x.jpg"]);
    expect(Object.keys(urls)).toEqual([key]);
    expect(urls[key]).toContain("ttl=600");
  });
});
