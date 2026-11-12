"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Ban, Search, UserPlus } from "@/presentation/components/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { CustomerFilter } from "@/application/ports/queries";
import { searchCustomersAction, type CustomerSearchResult } from "../../actions/customers";
import { EmptyState } from "../../components/empty-state";
import { ErrorState } from "../../components/error-state";
import { StatusBadge } from "../../components/status-badge";
import { Thumb } from "../../components/thumb";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Skeleton } from "../../components/ui/skeleton";
import { useFormat } from "../../lib/format-context";
import { useCustomerName } from "../../lib/use-text";
import { chipClass, chipRowClass, rowCardClass } from "../../components/chip";

const FILTERS: CustomerFilter[] = ["all", "has_dues", "overdue", "blocked", "archived"];
const PAGE = 30;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function CustomerList({ initialFilter = "all" }: { initialFilter?: CustomerFilter }) {
  const t = useTranslations("customers.list");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const nameOf = useCustomerName();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>(initialFilter);
  const query = useDebounced(q.trim(), 250);

  const result = useInfiniteQuery({
    queryKey: ["customers", query, filter],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<CustomerSearchResult> => {
      const r = await searchCustomersAction({ q: query || undefined, filter, offset: pageParam, limit: PAGE });
      if (!r.ok) throw new Error(r.code);
      return r.data;
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });

  const items = result.data?.pages.flatMap((p) => p.items) ?? [];
  const total = result.data?.pages[0]?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-12 pl-10 text-base"
        />
      </div>

      <div className={chipRowClass} role="tablist" aria-label={t("filters")}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={chipClass(filter === f)}
          >
            {t(`filter.${f}`)}
          </button>
        ))}
      </div>

      {result.isPending ? (
        <ul className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border p-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-20" />
            </li>
          ))}
        </ul>
      ) : result.isError ? (
        <ErrorState onRetry={() => void result.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          illustration="customers"
          title={query ? t("noResults") : t("empty")}
          body={query ? t("noResultsHint") : t("emptyHint")}
          action={
            <Button asChild className="h-11">
              <Link href={query && /^[\d০-৯+\s-]+$/.test(query) ? `/customers/new?phone=${encodeURIComponent(query)}` : "/customers/new"}>
                <UserPlus className="size-5" aria-hidden /> {t("add")}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("count", { count: fmt.number(total) })}
          </p>
          <ul className="space-y-2">
            {items.map((c) => {
              const name = nameOf(c);
              return (
                <li key={c.id}>
                  <Link href={`/customers/${c.id}`} className={rowCardClass}>
                    <Thumb url={c.thumbUrl} alt={tc("photoOf", { name })} kind="person" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{name}</span>
                      <span className="block text-sm text-muted-foreground">{fmt.phone(c.phone)}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {c.isBlocked && (
                          <StatusBadge tone="danger" icon={Ban}>
                            {t("blocked")}
                          </StatusBadge>
                        )}
                        {c.archived && <StatusBadge tone="neutral">{tc("archived")}</StatusBadge>}
                        {c.maxDaysOverdue > 0 && <StatusBadge tone="danger">{tc("daysOverdue", { days: fmt.number(c.maxDaysOverdue) })}</StatusBadge>}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="money block font-semibold">{fmt.money(c.balanceMinor)}</span>
                      {c.overdueMinor > 0 && <span className="money block text-xs text-destructive">{fmt.money(c.overdueMinor)}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {result.hasNextPage && (
            <Button variant="outline" className="h-11 w-full" disabled={result.isFetchingNextPage} onClick={() => void result.fetchNextPage()}>
              {result.isFetchingNextPage ? tc("loading") : tc("loadMore")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
