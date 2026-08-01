/* anchor: Linear issues list / Reservations desk table, diverge: bordered panels + one signal chip */
import { Link } from "react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type DashboardPanelProps = {
  title: string;
  total: number;
  viewAllHref?: string | null;
  emptyMessage?: string;
  isEmpty?: boolean;
  /** Quieter chrome for exception strip (same border system, not a colored card). */
  attention?: boolean;
  className?: string;
  children?: ReactNode;
};

export function DashboardPanel({
  title,
  total,
  viewAllHref,
  emptyMessage,
  isEmpty,
  attention,
  className,
  children,
}: DashboardPanelProps) {
  const { t } = useTranslation("dashboard");
  const showViewAll = Boolean(viewAllHref) && total > 0;

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b border-border px-3 py-2.5",
          attention && "bg-muted/40",
        )}
      >
        <h2 className="text-sm font-medium tracking-tight">
          {title}
          <span className="ml-1.5 text-muted-foreground tabular-nums">
            {total}
          </span>
        </h2>
        {showViewAll && viewAllHref && (
          <Link
            to={viewAllHref}
            className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("dashboard:panel.viewAll")}
          </Link>
        )}
      </div>

      {isEmpty ? (
        <Empty className="min-h-28 border-0 py-8">
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">
              {emptyMessage ?? t("dashboard:panel.nothingHere")}
            </EmptyTitle>
            <EmptyDescription className="text-xs">
              {t("dashboard:panel.quietHint")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        children
      )}
    </section>
  );
}
