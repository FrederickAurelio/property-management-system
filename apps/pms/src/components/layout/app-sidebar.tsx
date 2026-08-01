/* anchor: Linear-dense sidebar, diverge: Settings in Account group; chrome links only */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  type NavItem,
  accountNavItems,
  primaryNavItems,
  secondaryNavItems,
} from "@/config/nav";
import { staffSession } from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";
import { canViewReports } from "@/lib/staff-permissions";

function NavSidebarItem({ item }: { item: NavItem }) {
  const { t } = useTranslation(["common"]);
  const location = useLocation();
  const isActive =
    item.href === "/"
      ? location.pathname === "/"
      : location.pathname === item.href ||
        location.pathname.startsWith(`${item.href}/`);
  const title = t(item.titleKey);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={title}>
        <NavLink to={item.href} end={item.href === "/"}>
          <item.icon />
          <span>{title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavMenu({ items }: { items: NavItem[] }) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <NavSidebarItem key={item.href} item={item} />
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const { t } = useTranslation(["common"]);
  const { data: staff } = useQuery({
    queryKey: staffSessionQueryKey,
    queryFn: () => staffSession(),
  });

  const manageItems = secondaryNavItems.filter((item) => {
    if (item.href === "/reports") {
      return staff ? canViewReports(staff.role) : false;
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.operations")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavMenu items={primaryNavItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.manage")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavMenu items={manageItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.account")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavMenu items={accountNavItems} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <LanguageSwitcher className="px-2 pb-1 group-data-[collapsible=icon]:hidden" />
        {staff && (
          <div className="min-w-0 rounded-md px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{staff.username}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              {staff.role.replaceAll("_", " ")}
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
