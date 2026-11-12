import type { ReactNode } from "react";
import { Illustration, type IllustrationName } from "./illustration";

export function EmptyState({
  illustration,
  title,
  body,
  action,
}: {
  illustration: IllustrationName;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center">
      <span className="flex size-20 items-center justify-center rounded-3xl bg-gold-soft">
        <Illustration name={illustration} size={56} />
      </span>
      <p className="font-heading text-base font-semibold text-foreground">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
