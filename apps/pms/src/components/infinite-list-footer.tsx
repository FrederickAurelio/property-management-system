/* anchor: Linear infinite list footer, diverge: sentinel vs next-page retry */
import { useEffect } from "react";
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
 */
export function InfiniteListFooter({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
  errorMessage = "Couldn’t load more. Try again.",
}: InfiniteListFooterProps) {
  const { ref, inView } = useInView({
    rootMargin: "200px 0px",
  });

  useEffect(() => {
    if (
      !inView ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError
    ) {
      return;
    }
    fetchNextPage();
  }, [
    inView,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  ]);

  if (isFetchNextPageError) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
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
        Loading more…
      </div>
    );
  }

  return <div ref={ref} className="h-8 w-full" aria-hidden />;
}
