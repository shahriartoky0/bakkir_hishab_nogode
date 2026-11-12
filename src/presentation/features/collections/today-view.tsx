"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AGING_BUCKETS, type AgingBucket } from "@/domain/collections/aging";
import { EmptyState } from "../../components/empty-state";
import { useFormat } from "../../lib/format-context";
import { CollectionRowCard, type CollectionItem } from "./collection-row";
import { chipClass, chipRowClass } from "../../components/chip";

export interface TodaySections {
  promisesDueToday: CollectionItem[];
  dueToday: CollectionItem[];
  brokenPromises: CollectionItem[];
  overdue: CollectionItem[];
  upcoming: CollectionItem[];
  later: CollectionItem[];
}

const ORDER: { key: keyof TodaySections; amount: "promised" | "due" | "overdue" }[] = [
  { key: "promisesDueToday", amount: "promised" },
  { key: "dueToday", amount: "due" },
  { key: "brokenPromises", amount: "promised" },
  { key: "overdue", amount: "overdue" },
  { key: "upcoming", amount: "due" },
  { key: "later", amount: "due" },
];

/** Daily collections screen with an aging-bucket filter (spec 6.5). */
export function TodayView({ sections }: { sections: TodaySections }) {
  const t = useTranslations("collections");
  const te = useTranslations("enums.agingBucket");
  const fmt = useFormat();
  const [bucket, setBucket] = useState<AgingBucket | "all">("all");

  const filtered = (rows: CollectionItem[]) => (bucket === "all" ? rows : rows.filter((r) => r.bucket === bucket));
  const total = ORDER.reduce((n, s) => n + filtered(sections[s.key]).length, 0);

  return (
    <div className="space-y-5">
      <div className={chipRowClass} role="tablist" aria-label={t("agingFilter")}>
        {(["all", ...AGING_BUCKETS] as const).map((b) => (
          <button
            key={b}
            type="button"
            role="tab"
            aria-selected={bucket === b}
            onClick={() => setBucket(b)}
            className={chipClass(bucket === b)}
          >
            {b === "all" ? t("allBuckets") : te(b)}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <EmptyState illustration="check" title={t("allClear")} body={t("allClearHint")} />
      ) : (
        ORDER.map(({ key, amount }) => {
          const rows = filtered(sections[key]);
          if (rows.length === 0) return null;
          return (
            <section key={key} className="space-y-2" aria-labelledby={`sec-${key}`}>
              <h2 id={`sec-${key}`} className="flex items-baseline justify-between text-lg font-semibold">
                <span>{t(`sections.${key}`)}</span>
                <span className="text-sm font-normal text-muted-foreground">{fmt.number(rows.length)}</span>
              </h2>
              <ul className="space-y-2">
                {rows.map((r) => (
                  <CollectionRowCard key={`${key}-${r.customerId}`} row={r} amountLabel={t(`amount.${amount}`)} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
