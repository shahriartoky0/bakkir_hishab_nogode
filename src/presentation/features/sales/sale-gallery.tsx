"use client";

import { ChevronLeft, ChevronRight } from "@/presentation/components/icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";

export interface GalleryPhoto {
  thumbUrl: string | null;
  fullUrl: string | null;
  alt: string;
}

/** Thumbnails first; tap to open the full image with zoom (pinch / tap to enlarge). */
export function SaleGallery({ photos }: { photos: GalleryPhoto[] }) {
  const t = useTranslations("sales.detail");
  const [open, setOpen] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  if (photos.length === 0) return null;
  const current = open !== null ? photos[open] : null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((p, i) => (
          <li key={i}>
            <button
              type="button"
              className="block aspect-square w-full overflow-hidden rounded-lg border bg-muted"
              onClick={() => (setOpen(i), setZoom(false))}
              aria-label={t("openPhoto", { name: p.alt })}
            >
              {p.thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- presigned URL
                <img src={p.thumbUrl} alt={p.alt} loading="lazy" className="size-full object-cover" />
              )}
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-[min(96vw,64rem)] p-2 sm:p-4">
          <DialogTitle className="sr-only">{current?.alt}</DialogTitle>
          {current && (
            <div className="relative max-h-[80dvh] overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned URL */}
              <img
                src={current.fullUrl ?? current.thumbUrl ?? ""}
                alt={current.alt}
                onClick={() => setZoom((z) => !z)}
                className={zoom ? "max-w-none cursor-zoom-out" : "mx-auto max-h-[78dvh] w-auto cursor-zoom-in object-contain"}
                style={zoom ? { width: "200%" } : undefined}
              />
            </div>
          )}
          {photos.length > 1 && open !== null && (
            <div className="flex justify-between">
              <Button variant="outline" size="icon" className="size-11" aria-label={t("prevPhoto")} onClick={() => (setOpen((open - 1 + photos.length) % photos.length), setZoom(false))}>
                <ChevronLeft className="size-5" aria-hidden />
              </Button>
              <Button variant="outline" size="icon" className="size-11" aria-label={t("nextPhoto")} onClick={() => (setOpen((open + 1) % photos.length), setZoom(false))}>
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
