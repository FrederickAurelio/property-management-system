/* anchor: Linear mobile tab bar, diverge: More sheet → Manage + Settings only */
import type { LucideIcon } from "lucide-react";
import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  accountNavItems,
  mobileNavItems,
  secondaryNavItems,
} from "@/config/nav";
import { cn } from "@/lib/utils";

const bottomNavItemClass =
  "relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-xs font-medium text-muted-foreground";

function bottomNavActiveClass(active: boolean) {
  return cn(
    active && "rounded-lg bg-sidebar-accent text-sidebar-accent-foreground",
  );
}

function BottomNavItemContent({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="flex flex-col items-center gap-1">
      <Icon />
      <span className="max-w-full truncate">{label}</span>
    </span>
  );
}

function BottomNavLink({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(bottomNavItemClass, bottomNavActiveClass(isActive))
      }
    >
      <BottomNavItemContent icon={icon} label={label} />
    </NavLink>
  );
}

const moreLinks = [...secondaryNavItems, ...accountNavItems];

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {mobileNavItems.map((item) => (
            <BottomNavLink
              key={item.href}
              to={item.href}
              label={item.title}
              icon={item.icon}
              end={item.href === "/"}
            />
          ))}
          <button
            type="button"
            className={cn(bottomNavItemClass, bottomNavActiveClass(moreOpen))}
            onClick={() => {
              setMoreOpen(true);
            }}
          >
            <BottomNavItemContent icon={MoreHorizontalIcon} label="More" />
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription>
              Units, reports, and settings
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-1 px-4 pb-4">
            {moreLinks.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className="flex h-11 min-w-0 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted"
                onClick={() => {
                  setMoreOpen(false);
                }}
              >
                <item.icon />
                <span className="truncate">{item.title}</span>
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
