"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFormat } from "../../lib/format-context";

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const GRID = "var(--border)";

/** Compact taka for axis ticks: lakh/crore aware via the shared formatter. */
function useAxisMoney() {
  const fmt = useFormat();
  const t = useTranslations("dashboard.units");
  return (minor: number) => {
    const taka = minor / 100;
    if (taka >= 1_00_00_000) return `${fmt.number(Math.round(taka / 1_00_00_000))}${t("crore")}`;
    if (taka >= 1_00_000) return `${fmt.number(Math.round(taka / 1_00_000))}${t("lakh")}`;
    if (taka >= 1_000) return `${fmt.number(Math.round(taka / 1_000))}${t("thousand")}`;
    return fmt.number(taka);
  };
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color: string }[] }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: r.color }} aria-hidden />
          <span className="text-muted-foreground">{r.label}</span>
          <span className="money ml-auto font-medium">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Outstanding by aging bucket: one series, one hue (the title names it, so no legend). */
export function AgingChart({ data }: { data: { label: string; amountMinor: number }[] }) {
  const t = useTranslations("dashboard");
  const fmt = useFormat();
  const tick = useAxisMoney();
  return (
    <figure>
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={tick} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox title={String(label)} rows={[{ label: t("outstanding"), value: fmt.money(Number(payload[0]!.value)), color: "var(--chart-1)" }]} />
                ) : null
              }
            />
            <Bar dataKey="amountMinor" fill="var(--chart-1)" radius={[4, 4, 0, 0]} animationDuration={500} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t("aging")}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{fmt.money(d.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Collections vs new credit per month: two series, grouped, legend + tooltip. */
export function MonthlyChart({ data }: { data: { label: string; collectedMinor: number; newCreditMinor: number }[] }) {
  const t = useTranslations("dashboard");
  const fmt = useFormat();
  const tick = useAxisMoney();
  const names = { collectedMinor: t("collected"), newCreditMinor: t("newCredit") };
  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden />
          {names.collectedMinor}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-2" aria-hidden />
          {names.newCreditMinor}
        </span>
      </figcaption>
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={tick} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String(label)}
                    rows={payload.map((p) => ({
                      label: names[p.dataKey as keyof typeof names],
                      value: fmt.money(Number(p.value)),
                      color: String(p.color),
                    }))}
                  />
                ) : null
              }
            />
            <Bar dataKey="collectedMinor" fill="var(--chart-1)" radius={[4, 4, 0, 0]} animationDuration={500} maxBarSize={28} />
            <Bar dataKey="newCreditMinor" fill="var(--chart-2)" radius={[4, 4, 0, 0]} animationDuration={500} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t("monthly")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("month")}</th>
            <th scope="col">{names.collectedMinor}</th>
            <th scope="col">{names.newCreditMinor}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{fmt.money(d.collectedMinor)}</td>
              <td>{fmt.money(d.newCreditMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
