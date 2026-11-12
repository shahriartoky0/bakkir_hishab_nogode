/** UI language codes the domain knows about (data may be entered in either). */
export type Lang = "bn" | "en";

/** Pick the text for the current language, falling back to the other one. */
export function pickText(bn: string | null | undefined, en: string | null | undefined, lang: Lang): string {
  const first = (lang === "bn" ? bn : en)?.trim();
  if (first) return first;
  return ((lang === "bn" ? en : bn) ?? "").trim();
}

export function hasAnyText(bn: string | null | undefined, en: string | null | undefined): boolean {
  return Boolean(bn?.trim() || en?.trim());
}
