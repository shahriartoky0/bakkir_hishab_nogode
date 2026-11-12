import { ImageOff, User } from "@/presentation/components/icons";
import { cn } from "../lib/utils";

/** Small square thumbnail from a presigned URL, with an icon fallback. */
export function Thumb({
  url,
  alt,
  kind = "product",
  className,
}: {
  url: string | null | undefined;
  alt: string;
  kind?: "person" | "product";
  className?: string;
}) {
  const Icon = kind === "person" ? User : ImageOff;
  return (
    <span
      className={cn(
        "relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden bg-muted text-muted-foreground",
        kind === "person" ? "rounded-full" : "rounded-lg",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URLs
        <img src={url} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <Icon className="size-1/2" aria-hidden />
      )}
    </span>
  );
}
