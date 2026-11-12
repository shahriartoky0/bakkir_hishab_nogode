"use client";

import { Camera, ImagePlus, Loader2, X } from "@/presentation/components/icons";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { PhotoPurpose } from "@/application/use-cases/photos/create-photo-upload";
import { createPhotoUploadAction } from "../../actions/photos";
import { Button } from "../../components/ui/button";
import { useErrorText } from "../../hooks/use-error-text";
import { useFormat } from "../../lib/format-context";
import { cn } from "../../lib/utils";
import { compressPhoto } from "./compress";

export interface UploadedPhoto {
  fileKey: string;
  thumbKey: string;
  /** Local object URL or presigned GET URL used for the preview tile. */
  previewUrl: string;
}

interface PendingPhoto {
  id: string;
  previewUrl: string;
}

async function putBlob(url: string, blob: Blob, contentType: string) {
  const res = await fetch(url, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
  if (!res.ok) throw new Error(`Upload failed with ${res.status}`);
}

/**
 * Camera-first photo picker: compresses in the browser, uploads display +
 * thumbnail straight to R2 with presigned PUT URLs, and reports the stored keys.
 */
export function PhotoUpload({
  purpose,
  value,
  onChange,
  max = 4,
  disabled,
  className,
}: {
  purpose: PhotoPurpose;
  value: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("photos");
  const errorText = useErrorText();
  const fmt = useFormat();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [pending, setPending] = useState<PendingPhoto[]>([]);

  // Keep the latest value for async callbacks that resolve after re-renders.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const remaining = max - value.length - pending.length;

  async function uploadOne(file: File) {
    const id = crypto.randomUUID();
    const localUrl = URL.createObjectURL(file);
    setPending((p) => [...p, { id, previewUrl: localUrl }]);
    try {
      const { display, thumb } = await compressPhoto(file);
      const presign = await createPhotoUploadAction({
        purpose,
        contentType: display.type,
        displaySize: display.size,
        thumbSize: thumb.size,
      });
      if (!presign.ok) {
        toast.error(errorText(presign.code, presign.details));
        URL.revokeObjectURL(localUrl);
        return;
      }
      const { displayUploadUrl, thumbUploadUrl, fileKey, thumbKey, contentType } = presign.data;
      await Promise.all([
        putBlob(displayUploadUrl, display, contentType),
        putBlob(thumbUploadUrl, thumb, contentType),
      ]);
      const next = [...valueRef.current, { fileKey, thumbKey, previewUrl: localUrl }];
      valueRef.current = next;
      onChange(next);
    } catch {
      toast.error(t("failed"));
      URL.revokeObjectURL(localUrl);
    } finally {
      setPending((p) => p.filter((x) => x.id !== id));
    }
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).slice(0, Math.max(0, remaining));
    list.forEach((f) => void uploadOne(f));
  }

  function remove(index: number) {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  }

  const busy = pending.length > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {(value.length > 0 || busy) && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((p, i) => (
            <li key={p.fileKey} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned/blob URLs */}
              <img src={p.previewUrl} alt={t("alt", { n: fmt.number(i + 1) })} className="size-full object-cover" />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute top-1 right-1 size-8 rounded-full shadow"
                aria-label={t("remove")}
                onClick={() => remove(i)}
                disabled={disabled}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URL preview */}
              <img src={p.previewUrl} alt="" className="size-full object-cover opacity-50" />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-medium">
                <Loader2 className="size-6 animate-spin" aria-hidden />
                {t("uploading")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="h-12"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="size-5" aria-hidden /> {t("camera")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            disabled={disabled}
            onClick={() => galleryRef.current?.click()}
          >
            <ImagePlus className="size-5" aria-hidden /> {t("gallery")}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t("count", { count: fmt.number(value.length), max: fmt.number(max) })}
      </p>

      <input
        id={`${inputId}-camera`}
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        id={`${inputId}-gallery`}
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple={max > 1}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
