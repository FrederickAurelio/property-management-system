/* anchor: Linear infinite list footer, diverge: sentinel vs next-page retry */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useInView } from "react-intersection-observer";
import { QueryRetryButton } from "@/components/query-retry-button";
import { Spinner } from "@/components/ui/spinner";

type InfiniteListFooterProps = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => void;
  /** Short message when the next page fails. */
  errorMessage?: string;
};

/**
 * Infinite-scroll footer for offset lists.
 * On next-page error: unmount sentinel and show retry (avoids inView fetch loop).
 * `fetchNextPage` is read via ref so unstable inline lambdas do not re-trigger fetch.
 */
export function InfiniteListFooter({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
  errorMessage,
}: InfiniteListFooterProps) {
  const { t } = useTranslation(["common"]);
  const resolvedErrorMessage = errorMessage ?? t("misc.loadMoreError");
  const { ref, inView } = useInView({
    rootMargin: "200px 0px",
  });
  const fetchNextPageRef = useRef(fetchNextPage);

  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage;
  }, [fetchNextPage]);

  useEffect(() => {
    if (!inView || !hasNextPage || isFetchingNextPage || isFetchNextPageError) {
      return;
    }
    fetchNextPageRef.current();
  }, [inView, hasNextPage, isFetchingNextPage, isFetchNextPageError]);

  if (isFetchNextPageError) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <p className="text-sm text-muted-foreground">{resolvedErrorMessage}</p>
        <QueryRetryButton
          onRetry={fetchNextPage}
          isRetrying={isFetchingNextPage}
        />
      </div>
    );
  }

  if (!hasNextPage) {
    return null;
  }

  if (isFetchingNextPage) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t("misc.loadingMore")}
      </div>
    );
  }

  return <div ref={ref} className="h-8 w-full" aria-hidden />;
}
