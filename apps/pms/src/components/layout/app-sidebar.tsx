/* anchor: Linear-dense sidebar, diverge: Settings in Account group; chrome links only */
import { useQuery } from "@tanstack/react-query";
import { NavLink, useLocation } from "react-router";
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

function NavSidebarItem({ item }: { item: NavItem }) {
  const location = useLocation();
  const isActive =
    item.href === "/"
      ? location.pathname === "/"
      : location.pathname === item.href ||
        location.pathname.startsWith(`${item.href}/`);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
        <NavLink to={item.href} end={item.href === "/"}>
          <item.icon />
          <span>{item.title}</span>
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
  const { data: staff } = useQuery({
    queryKey: staffSessionQueryKey,
    queryFn: () => staffSession(),
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavMenu items={primaryNavItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavMenu items={secondaryNavItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavMenu items={accountNavItems} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
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
