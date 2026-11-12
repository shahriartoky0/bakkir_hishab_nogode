"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { bindFormat, type FormatPrefs } from "./format";

const FormatContext = createContext<FormatPrefs | null>(null);

export function FormatProvider({ prefs, children }: { prefs: FormatPrefs; children: ReactNode }) {
  return <FormatContext value={prefs}>{children}</FormatContext>;
}

/** Formatting helpers bound to the current language and digit preference. */
export function useFormat() {
  const prefs = useContext(FormatContext);
  if (!prefs) throw new Error("useFormat must be used inside <FormatProvider>");
  return useMemo(() => bindFormat(prefs), [prefs]);
}
