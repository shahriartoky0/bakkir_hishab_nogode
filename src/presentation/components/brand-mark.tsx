import { cn } from "../lib/utils";

/** The app icon (gold coin with ledger lines on navy) as an inline SVG, crisp at any size. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-9 shrink-0", className)} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#142340" />
      <circle cx="24" cy="24" r="15.5" fill="#c9900c" />
      <circle cx="24" cy="24" r="12.5" fill="#f3c63f" />
      <rect x="17" y="20.2" width="14" height="2.6" rx="1.3" fill="#142340" />
      <rect x="17" y="25.6" width="14" height="2.6" rx="1.3" fill="#142340" />
    </svg>
  );
}
