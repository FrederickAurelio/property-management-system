/* anchor: Linear-dense shell, diverge: mobile bottom nav + Cabin warm primary tokens */
import { Suspense } from "react";
import { Outlet } from "react-router";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PageRouteFallback } from "@/components/page-route-fallback";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout() {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen>
      {!isMobile && <AppSidebar />}
      <SidebarInset>
        <AppHeader />
        <div className="flex min-h-[calc(100svh-3rem)] flex-1 flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
          <Suspense fallback={<PageRouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
      {isMobile && <BottomNav />}
    </SidebarProvider>
  );
}
