"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "./ui/sonner";
import { FormatProvider } from "../lib/format-context";
import type { FormatPrefs } from "../lib/format";

export function Providers({ children, formatPrefs }: { children: ReactNode; formatPrefs: FormatPrefs }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <FormatProvider prefs={formatPrefs}>
          {children}
          <Toaster richColors position="top-center" closeButton />
        </FormatProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
