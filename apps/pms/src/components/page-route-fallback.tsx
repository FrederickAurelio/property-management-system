/* anchor: Linear-dense shell, diverge: route-chunk skeleton inside the app chrome */
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Placeholder while a lazy route chunk loads — keeps sidebar/header mounted. */
export function PageRouteFallback({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("common");

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3",
        !compact && "mx-auto max-w-6xl p-4 md:p-6",
      )}
      aria-busy="true"
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-[min(24rem,calc(100svh-12rem))] w-full" />
      <span className="sr-only">{t("misc.loading")}</span>
    </div>
  );
}
