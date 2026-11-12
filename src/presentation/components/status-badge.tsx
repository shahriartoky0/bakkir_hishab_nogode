import { AlertTriangle, CheckCircle2, Circle, Clock, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const TONES: Record<Tone, { cls: string; icon: LucideIcon }> = {
  success: { cls: "bg-success-soft text-success border-success/30", icon: CheckCircle2 },
  warning: { cls: "bg-warning-soft text-warning border-warning/30", icon: Clock },
  danger: { cls: "bg-destructive-soft text-destructive border-destructive/30", icon: AlertTriangle },
  neutral: { cls: "bg-muted text-muted-foreground border-border", icon: Circle },
  info: { cls: "bg-gold-soft text-gold border-gold/30", icon: XCircle },
};

/** Status is never shown by colour alone: every badge has an icon and text. */
export function StatusBadge({ tone, children, className, icon }: { tone: Tone; children: ReactNode; className?: string; icon?: LucideIcon }) {
  const { cls, icon: DefaultIcon } = TONES[tone];
  const Icon = icon ?? DefaultIcon;
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        cls,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}

export const installmentTone = (s: "paid" | "overdue" | "due_today" | "upcoming"): Tone =>
  s === "paid" ? "success" : s === "overdue" ? "danger" : s === "due_today" ? "warning" : "neutral";

export const saleTone = (s: "open" | "closed" | "written_off" | "cancelled"): Tone =>
  s === "closed" ? "success" : s === "open" ? "warning" : s === "written_off" ? "info" : "neutral";

export const promiseTone = (s: "pending" | "kept" | "broken"): Tone =>
  s === "kept" ? "success" : s === "broken" ? "danger" : "warning";
