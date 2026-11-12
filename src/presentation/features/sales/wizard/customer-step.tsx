"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, Search, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { searchCustomersAction } from "../../../actions/customers";
import { StatusBadge } from "../../../components/status-badge";
import { Thumb } from "../../../components/thumb";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Skeleton } from "../../../components/ui/skeleton";
import { useFormat } from "../../../lib/format-context";
import { useCustomerName } from "../../../lib/use-text";
import { CustomerForm } from "../../customers/customer-form";
import { rowCardClass } from "../../../components/chip";
import { cn } from "../../../lib/utils";

export interface PickedCustomer {
  id: string;
  name: string;
  phone: string;
  thumbUrl: string | null;
  balanceMinor: number;
  isBlocked: boolean;
}

/** Step 1: find the customer by phone (or name), or create one inline. */
export function CustomerStep({ value, onChange }: { value: PickedCustomer | null; onChange: (c: PickedCustomer | null) => void }) {
  const t = useTranslations("sales.wizard");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const nameOf = useCustomerName();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const results = useQuery({
    queryKey: ["customer-pick", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const r = await searchCustomersAction({ q: debounced, filter: "all", limit: 8 });
      if (!r.ok) throw new Error(r.code);
      return r.data.items;
    },
  });

  if (value) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3">
          <Thumb url={value.thumbUrl} alt={tc("photoOf", { name: value.name })} kind="person" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{value.name}</p>
            <p className="text-sm text-muted-foreground">{fmt.phone(value.phone)}</p>
            <p className="text-sm">{t("currentBalance", { amount: fmt.money(value.balanceMinor) })}</p>
            {value.isBlocked && (
              <StatusBadge tone="danger" icon={Ban}>
                {t("blocked")}
              </StatusBadge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="size-11" aria-label={t("changeCustomer")} onClick={() => onChange(null)}>
            <X className="size-5" aria-hidden />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (creating) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" className="h-11" onClick={() => setCreating(false)}>
          <Search className="size-5" aria-hidden /> {t("backToSearch")}
        </Button>
        <CustomerForm
          compact
          initialPhone={/^[\d০-৯+\s-]+$/.test(q) ? q : ""}
          onSaved={(id, name, phone) => {
            setCreating(false);
            onChange({ id, name, phone, thumbUrl: null, balanceMinor: 0, isBlocked: false });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          autoFocus
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("findCustomer")}
          aria-label={t("findCustomer")}
          className="h-12 pl-10 text-base"
        />
      </div>
      <Button variant="outline" className="h-12 w-full" onClick={() => setCreating(true)}>
        <UserPlus className="size-5" aria-hidden /> {t("newCustomer")}
      </Button>

      {debounced.length >= 2 &&
        (results.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : results.data && results.data.length > 0 ? (
          <ul className="space-y-2">
            {results.data.map((c) => {
              const name = nameOf(c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={c.archived}
                    onClick={() =>
                      onChange({ id: c.id, name, phone: c.phone, thumbUrl: c.thumbUrl, balanceMinor: c.balanceMinor, isBlocked: c.isBlocked })
                    }
                    className={cn(rowCardClass, "w-full text-left disabled:opacity-50")}
                  >
                    <Thumb url={c.thumbUrl} alt={tc("photoOf", { name })} kind="person" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{name}</span>
                      <span className="block text-sm text-muted-foreground">{fmt.phone(c.phone)}</span>
                    </span>
                    <span className="money text-sm font-semibold">{fmt.money(c.balanceMinor)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t("noCustomerFound")}</p>
        ))}
    </div>
  );
}
