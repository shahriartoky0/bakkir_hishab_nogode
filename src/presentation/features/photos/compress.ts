import imageCompression from "browser-image-compression";

/** Spec 2: display ≤1600px (~300 KB) and thumbnail ≤320px (~30 KB), both JPEG. */
export const DISPLAY_MAX_PX = 1600;
export const DISPLAY_MAX_MB = 0.3;
export const THUMB_MAX_PX = 320;
export const THUMB_MAX_MB = 0.03;
export const OUTPUT_TYPE = "image/jpeg";

export interface CompressedPhoto {
  display: File;
  thumb: File;
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const common = { useWebWorker: true, fileType: OUTPUT_TYPE, initialQuality: 0.82 } as const;
  const display = await imageCompression(file, {
    ...common,
    maxWidthOrHeight: DISPLAY_MAX_PX,
    maxSizeMB: DISPLAY_MAX_MB,
  });
  // Thumbnail from the already-reduced image: faster, same orientation fix applied.
  const thumb = await imageCompression(display, {
    ...common,
    maxWidthOrHeight: THUMB_MAX_PX,
    maxSizeMB: THUMB_MAX_MB,
  });
  return { display, thumb };
}
