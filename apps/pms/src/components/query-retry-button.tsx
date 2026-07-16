import { RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type QueryRetryButtonProps = {
  onRetry: () => void;
  isRetrying?: boolean;
  label?: string;
  className?: string;
};

/** Shared control for failed GET states — pair with Skeleton loading. */
export function QueryRetryButton({
  onRetry,
  isRetrying = false,
  label = "Retry",
  className,
}: QueryRetryButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={isRetrying}
      onClick={onRetry}
    >
      {isRetrying ? (
        <>
          <Spinner data-icon="inline-start" />
          Retrying…
        </>
      ) : (
        <>
          <RotateCwIcon data-icon="inline-start" />
          {label}
        </>
      )}
    </Button>
  );
}
