import { cn } from "../lib/utils";

/** One look for every filter chip / segmented pill in the app. */
export function chipClass(active: boolean, className?: string) {
  return cn(
    "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150",
    active
      ? "border-primary bg-primary text-primary-foreground shadow-xs"
      : "border-border bg-card text-foreground hover:border-input hover:bg-accent",
    className,
  );
}

/** Horizontally scrollable chip row that bleeds to the screen edge on mobile. */
export const chipRowClass = "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0";

/** Option tiles (payment method, follow-up outcome, field type…): large, tappable, clear selected state. */
export function optionClass(active: boolean, className?: string) {
  return cn(
    "min-h-12 rounded-xl border px-3 text-sm font-medium transition-colors duration-150",
    active ? "border-primary bg-primary text-primary-foreground shadow-xs" : "border-border bg-card hover:border-input hover:bg-accent",
    className,
  );
}

/** A tappable list row card. */
export const rowCardClass = "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card transition-colors duration-150 hover:border-input hover:bg-accent/60";
