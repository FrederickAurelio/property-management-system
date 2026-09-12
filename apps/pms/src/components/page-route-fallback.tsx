/* anchor: GitHub hairline + Linear work-surface skeleton, diverge: Cabin primary bar; no inner title (header already names the page) */
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type WorkSurface =
  "calendar" | "detail" | "explorer" | "list" | "reports" | "settings";

function workSurface(pathname: string): WorkSurface {
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) {
    return "calendar";
  }
  if (/^\/reservations\/[^/]+/.test(pathname)) {
    return "detail";
  }
  if (pathname === "/properties" || pathname.startsWith("/properties/")) {
    return "explorer";
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "reports";
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "settings";
  }
  return "list";
}

function RouteProgressBar() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-primary/15"
      aria-hidden
    >
      <div className="h-full w-1/3 animate-route-progress bg-primary motion-reduce:translate-x-0 motion-reduce:animate-none" />
    </div>
  );
}

function FilterRow() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-9 w-28 sm:ml-auto" />
    </div>
  );
}

function ListRows({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

function CalendarSurface() {
  return (
    <div className="flex flex-col gap-3">
      <FilterRow />
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex border-b border-border">
          <div className="w-[min(11rem,42vw)] shrink-0 border-r border-border p-2.5">
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="flex min-w-0 flex-1 gap-2 p-2.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-3 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, row) => (
          <div
            key={row}
            className="flex h-11 border-b border-border last:border-b-0"
          >
            <div className="flex w-[min(11rem,42vw)] shrink-0 items-center border-r border-border px-2.5">
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="min-w-0 flex-1 bg-muted/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExplorerSurface() {
  return (
    <div className="flex flex-col gap-3">
      <FilterRow />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <Skeleton className="size-12 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="mt-1.5 h-3 w-48 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSurface() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-28" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>
    </div>
  );
}

function ReportsSurface() {
  return (
    <div className="flex flex-col gap-6">
      <FilterRow />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

function SettingsSurface() {
  return (
    <div className="flex flex-col gap-8">
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-52 max-w-full" />
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
      ))}
    </div>
  );
}

function ListSurface() {
  return (
    <div className="flex flex-col gap-4">
      <FilterRow />
      <ListRows />
    </div>
  );
}

/** Placeholder while a lazy route chunk loads — keeps sidebar/header mounted. */
export function PageRouteFallback({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("common");
  const { pathname } = useLocation();
  const surface = workSurface(pathname);

  return (
    <div
      className={cn(
        "flex w-full flex-col",
        !compact && "mx-auto p-4 md:p-6",
        !compact && surface === "calendar" && "max-w-[1600px]",
        !compact && surface === "detail" && "max-w-4xl",
        !compact && surface === "reports" && "max-w-5xl",
        !compact && surface === "settings" && "max-w-3xl",
        !compact &&
          (surface === "list" || surface === "explorer") &&
          "max-w-6xl",
      )}
      aria-busy="true"
    >
      {!compact && <RouteProgressBar />}
      {surface === "calendar" && <CalendarSurface />}
      {surface === "detail" && <DetailSurface />}
      {surface === "explorer" && <ExplorerSurface />}
      {surface === "list" && <ListSurface />}
      {surface === "reports" && <ReportsSurface />}
      {surface === "settings" && <SettingsSurface />}
      <span className="sr-only">{t("misc.loading")}</span>
    </div>
  );
}
