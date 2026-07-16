import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  LayoutDashboard,
  Settings,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Primary destinations shown in the mobile bottom bar */
  mobile?: boolean;
};

export const primaryNavItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, mobile: true },
  { title: "Calendar", href: "/calendar", icon: CalendarDays, mobile: true },
  {
    title: "Reservations",
    href: "/reservations",
    icon: ClipboardList,
    mobile: true,
  },
  { title: "Check-in", href: "/check-in", icon: DoorOpen, mobile: true },
];

/** Property ops — not account/security */
export const secondaryNavItems: NavItem[] = [
  { title: "Units", href: "/units", icon: Building2 },
  { title: "Reports", href: "/reports", icon: BarChart3 },
];

/** Account + appearance (+ staff for SUPER_ADMIN). Not in Manage. */
export const accountNavItems: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
];

export const mobileNavItems = primaryNavItems.filter((item) => item.mobile);

export const allNavItems = [
  ...primaryNavItems,
  ...secondaryNavItems,
  ...accountNavItems,
];

export function getNavTitle(pathname: string): string {
  const match = allNavItems.find(
    (item) =>
      item.href === pathname ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
  );
  return match?.title ?? "Cabin PMS";
}
