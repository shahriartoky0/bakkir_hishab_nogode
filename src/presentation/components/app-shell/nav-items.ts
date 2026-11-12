import { Home, CalendarClock, Users, Plus, Menu, type LucideIcon } from "lucide-react";

export type NavKey = "home" | "today" | "customers" | "newSale" | "more";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** The prominent centre action on mobile. */
  primary?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "/", icon: Home },
  { key: "today", href: "/today", icon: CalendarClock },
  { key: "newSale", href: "/sales/new", icon: Plus, primary: true },
  { key: "customers", href: "/customers", icon: Users },
  { key: "more", href: "/more", icon: Menu },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
