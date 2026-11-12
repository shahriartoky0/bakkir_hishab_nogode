import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Hind_Siliguri } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { APP_NAME } from "@/domain/shared/app";
import { Providers } from "@/presentation/components/providers";
import { getFormatPrefs } from "@/presentation/lib/format-server";
import "./globals.css";

const bangla = Hind_Siliguri({
  variable: "--font-bangla",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Headings and big numbers: a modern variable Bangla sans with Latin glyphs (MASTER.md). */
const heading = Anek_Bangla({
  variable: "--font-heading-bangla",
  subsets: ["bengali", "latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: `%s · ${APP_NAME}` },
    description: t("description"),
    robots: { index: false, follow: false },
    applicationName: APP_NAME,
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const formatPrefs = await getFormatPrefs();

  return (
    <html lang={locale} className={`${bangla.variable} ${heading.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers formatPrefs={formatPrefs}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
