import { Home, CalendarClock, Users, Plus, Menu, type AppIcon } from "@/presentation/components/icons";
import type { IllustrationName } from "../illustration";

export type NavKey = "home" | "today" | "customers" | "newSale" | "more";

export interface NavItem {
  key: NavKey;
  href: string;
  /** Compact glyph (used on the primary action button). */
  icon: AppIcon;
  /** Fluent 3D illustration shown in the nav lists. */
  illustration: IllustrationName;
  /** The prominent centre action on mobile. */
  primary?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "/", icon: Home, illustration: "house" },
  { key: "today", href: "/today", icon: CalendarClock, illustration: "calendar" },
  { key: "newSale", href: "/sales/new", icon: Plus, illustration: "money-bag", primary: true },
  { key: "customers", href: "/customers", icon: Users, illustration: "customers" },
  { key: "more", href: "/more", icon: Menu, illustration: "more" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
