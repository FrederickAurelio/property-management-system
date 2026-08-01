import { RotateCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  label,
  className,
}: QueryRetryButtonProps) {
  const { t } = useTranslation(["common"]);

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
          {t("actions.retrying")}
        </>
      ) : (
        <>
          <RotateCwIcon data-icon="inline-start" />
          {label ?? t("actions.retry")}
        </>
      )}
    </Button>
  );
}
