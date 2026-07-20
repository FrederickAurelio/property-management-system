import type { ReactNode } from "react";
import { QueryRetryButton } from "@/components/query-retry-button";
import { cn } from "@/lib/utils";

type QueryErrorPanelProps = {
  message: ReactNode;
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
};

/** Shared failed-GET panel — bordered message + Retry. */
export function QueryErrorPanel({
  message,
  onRetry,
  isRetrying = false,
  className,
}: QueryErrorPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-border px-4 py-6",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{message}</p>
      <QueryRetryButton onRetry={onRetry} isRetrying={isRetrying} />
    </div>
  );
}
