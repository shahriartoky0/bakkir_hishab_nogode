import bn from "@messages/bn.json";
import en from "@messages/en.json";
import type { AppLocale } from "./config";

export type Messages = typeof bn;

const BASE: Record<AppLocale, Messages> = { bn, en };

type Tree = { [k: string]: Tree | string };

/** "a.b.c" → value for every leaf message. */
export function flattenMessages(obj: Tree, prefix = "", out = new Map<string, string>()): Map<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else flattenMessages(v, key, out);
  }
  return out;
}

/** Every message key present in the files (both locales have the same keys; i18n:check enforces it). */
export const MESSAGE_KEYS: ReadonlySet<string> = new Set(flattenMessages(bn as unknown as Tree).keys());

/** File defaults for both locales, for the wording editor. */
export function defaultMessages(): { key: string; bn: string; en: string }[] {
  const b = flattenMessages(bn as unknown as Tree);
  const e = flattenMessages(en as unknown as Tree);
  return [...b.keys()].map((key) => ({ key, bn: b.get(key)!, en: e.get(key) ?? "" }));
}

/** Copy `base` with `overrides` (dotted keys) applied; unknown keys are ignored. */
export function applyOverrides(base: Messages, overrides: readonly { key: string; value: string }[]): Messages {
  if (overrides.length === 0) return base;
  const copy = structuredClone(base) as unknown as Tree;
  for (const { key, value } of overrides) {
    const parts = key.split(".");
    let node: Tree | string | undefined = copy;
    for (const p of parts.slice(0, -1)) node = typeof node === "object" ? node[p] : undefined;
    const leaf = parts[parts.length - 1]!;
    if (node && typeof node === "object" && typeof node[leaf] === "string") node[leaf] = value;
  }
  return copy as unknown as Messages;
}

/**
 * File messages are the base; wording overrides saved in Neon (translation_overrides)
 * are merged on top. The overrides are cached in memory by the composition root and
 * invalidated on save. If the database is unreachable, the file text is used.
 */
export async function loadMessages(locale: AppLocale): Promise<Messages> {
  try {
    const { container } = await import("@/composition/container");
    container.setKnownMessageKeys(MESSAGE_KEYS);
    const all = await container.translationOverrides();
    return applyOverrides(BASE[locale], all.filter((o) => o.locale === locale));
  } catch (e) {
    console.error("[i18n] could not load wording overrides; using file messages", e);
    return BASE[locale];
  }
}
