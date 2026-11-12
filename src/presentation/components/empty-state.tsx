import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-gold-soft text-gold">
        <Icon className="size-7" aria-hidden />
      </span>
      <p className="font-heading text-base font-semibold text-foreground">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
