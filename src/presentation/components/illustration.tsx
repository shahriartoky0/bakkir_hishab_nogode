import Image from "next/image";
import { cn } from "../lib/utils";

/**
 * Microsoft Fluent Emoji 3D (MIT, github.com/microsoft/fluentui-emoji), vendored
 * under /public/illustrations/fluent — see SOURCE.md there for the pinned commit.
 *
 * Use only for decorative "hero" spots at ≥24px (nav, tiles, empty states).
 * Small controls keep the Phosphor glyphs from ./icons.
 */
const ILLUSTRATIONS = {
  alarm: "alarm",
  "bar-chart": "bar-chart",
  calendar: "calendar",
  "card-box": "card-box",
  "chart-up": "chart-up",
  check: "check",
  coin: "coin",
  customers: "customers",
  floppy: "floppy",
  gem: "gem",
  globe: "globe",
  hourglass: "hourglass",
  house: "house",
  lock: "lock",
  "money-bag": "money-bag",
  "money-wings": "money-wings",
  more: "more",
  palette: "palette",
  party: "party",
  receipt: "receipt",
  scroll: "scroll",
  speech: "speech",
  store: "store",
  warning: "warning",
  wastebasket: "wastebasket",
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

export function Illustration({
  name,
  size = 40,
  className,
  alt,
  eager,
}: {
  name: IllustrationName;
  /** Rendered px size (square). */
  size?: number;
  className?: string;
  /** Omit for decorative use (the default): hidden from assistive tech. */
  alt?: string;
  /** Above-the-fold: load eagerly. */
  eager?: boolean;
}) {
  return (
    <Image
      src={`/illustrations/fluent/${ILLUSTRATIONS[name]}.png`}
      width={size}
      height={size}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      loading={eager ? "eager" : undefined}
      className={cn("pointer-events-none shrink-0 select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
