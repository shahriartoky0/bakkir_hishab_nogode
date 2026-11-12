import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { SettingsRecord } from "@/application/ports/records";
import { container } from "@/composition/container";
import { pickText } from "@/domain/shared/bilingual";
import { isLocale } from "../../i18n/config";
import { getFormat } from "../../lib/format-server";
import { currentLang, param, signPhotos } from "../../lib/server";
import { cn } from "../../lib/utils";
import { PrintToolbar } from "./print-toolbar";

export type PrintParams = Record<string, string | string[] | undefined>;

/** Language and paper size for a print view: ?lang=bn|en (default: UI language), ?size=a4|80. */
export async function printContext(sp: PrintParams) {
  const requested = param(sp.lang);
  const lang = isLocale(requested) ? requested : await currentLang();
  const size: "a4" | "80" = param(sp.size) === "80" ? "80" : "a4";
  const [t, fmt, settings] = await Promise.all([getTranslations({ locale: lang, namespace: "print" }), getFormat(lang), container.settings()]);
  const text = (bn: string | null | undefined, en: string | null | undefined) => pickText(bn, en, lang);
  return { lang, size, t, fmt, settings, text };
}

/** Printable page: screen toolbar + paper with the shop header and footer. */
export async function PrintFrame({
  ctx,
  backHref,
  title,
  number,
  children,
  voided,
  toolbarExtra,
}: {
  ctx: Awaited<ReturnType<typeof printContext>>;
  backHref: string;
  title: string;
  number?: string;
  children: ReactNode;
  voided?: boolean;
  toolbarExtra?: ReactNode;
}) {
  const { settings, text, t, size, lang } = ctx;
  const urls = await signPhotos([settings.logoKey]);
  return (
    <div>
      <PrintToolbar backHref={backHref} lang={lang} size={size}>
        {toolbarExtra}
      </PrintToolbar>
      <article
        lang={lang}
        className={cn(
          "relative mx-auto bg-white text-black shadow-sm print:shadow-none",
          size === "80" ? "print-80mm p-3 text-[13px]" : "max-w-[210mm] rounded-lg border p-6 print:border-0 print:p-0",
        )}
      >
        {voided && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 rounded-lg border-4 border-red-600 px-6 py-2 text-5xl font-bold tracking-widest text-red-600 opacity-60">
              {t("void")}
            </span>
          </div>
        )}
        <ShopHeader settings={settings} text={text} logoUrl={settings.logoKey ? (urls[settings.logoKey] ?? null) : null} compact={size === "80"} />
        <div className={cn("my-3 border-y border-black/70 py-2 text-center", size === "80" ? "text-sm" : "text-lg")}>
          <p className="font-semibold">{title}</p>
          {number && <p className="font-mono text-sm">{number}</p>}
          {voided && <p className="font-bold text-red-600">{t("voidNotice")}</p>}
        </div>
        {children}
        {text(settings.receiptFooterBn, settings.receiptFooterEn) && (
          <p className="mt-4 border-t border-black/30 pt-2 text-center text-xs whitespace-pre-line">{text(settings.receiptFooterBn, settings.receiptFooterEn)}</p>
        )}
      </article>
    </div>
  );
}

function ShopHeader({
  settings,
  text,
  logoUrl,
  compact,
}: {
  settings: SettingsRecord;
  text: (bn: string | null | undefined, en: string | null | undefined) => string;
  logoUrl: string | null;
  compact: boolean;
}) {
  const name = text(settings.shopNameBn, settings.shopNameEn);
  const address = text(settings.addressBn, settings.addressEn);
  return (
    <header className={cn("flex items-center gap-3", compact && "flex-col text-center")}>
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL
        <img src={logoUrl} alt="" className={compact ? "h-12 w-auto" : "h-16 w-auto"} />
      )}
      <div className={compact ? "" : "flex-1"}>
        {name && <p className={cn("font-bold", compact ? "text-base" : "text-2xl")}>{name}</p>}
        {address && <p className="text-xs whitespace-pre-line">{address}</p>}
        {settings.phone && <p className="text-xs">{settings.phone}</p>}
      </div>
    </header>
  );
}

/** Two-column label/value row used on receipts. */
export function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3 py-0.5", strong && "font-semibold")}>
      <span>{label}</span>
      <span className="money text-right">{value}</span>
    </div>
  );
}
