import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ScrollText,
  Settings,
} from "lucide-react";

export type NavItem = {
  /** i18n key in the `common` namespace, e.g. "nav.dashboard" */
  titleKey: string;
  href: string;
  icon: LucideIcon;
  /** Primary destinations shown in the mobile bottom bar */
  mobile?: boolean;
};

export const primaryNavItems: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/", icon: LayoutDashboard, mobile: true },
  {
    titleKey: "nav.calendar",
    href: "/calendar",
    icon: CalendarDays,
    mobile: true,
  },
  {
    titleKey: "nav.reservations",
    href: "/reservations",
    icon: ClipboardList,
    mobile: true,
  },
];

/** Property ops — not account/security */
export const secondaryNavItems: NavItem[] = [
  { titleKey: "nav.properties", href: "/properties", icon: Building2 },
  { titleKey: "nav.reports", href: "/reports", icon: BarChart3 },
];

/** Header title only — opened from Settings, not sidebar. */
export const requestLogsNavItem: NavItem = {
  titleKey: "nav.requestLogs",
  href: "/request-logs",
  icon: ScrollText,
};

/** Account + appearance (+ staff for SUPER_ADMIN). Not in Manage. */
export const accountNavItems: NavItem[] = [
  { titleKey: "nav.settings", href: "/settings", icon: Settings },
];

export const mobileNavItems = primaryNavItems.filter((item) => item.mobile);

export const allNavItems = [
  ...primaryNavItems,
  ...secondaryNavItems,
  ...accountNavItems,
  requestLogsNavItem,
];

/** Returns the `common` namespace i18n key for the nav item matching `pathname`, if any. */
export function getNavTitleKey(pathname: string): string | undefined {
  const match = allNavItems.find(
    (item) =>
      item.href === pathname ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
  );
  return match?.titleKey;
}
