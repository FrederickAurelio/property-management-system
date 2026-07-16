/* anchor: Linear app chrome, diverge: sidebar trigger only on desktop */
import { useLocation } from "react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getNavTitle } from "@/config/nav";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppHeader() {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const title = getNavTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      {!isMobile && <SidebarTrigger className="-ml-1" />}
      <h1 className="min-w-0 truncate text-sm font-medium">{title}</h1>
    </header>
  );
}
