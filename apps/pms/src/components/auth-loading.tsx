/* anchor: Linear session gate — centered quiet spinner, diverge: Outfit + muted copy */
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";

/**
 * Full-viewport pending state while resolving the staff session (`/api/auth/session`).
 */
export function AuthLoading() {
  const { t } = useTranslation(["common"]);

  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background"
      aria-busy="true"
    >
      <Spinner
        className="size-5 text-muted-foreground motion-reduce:animate-none"
        aria-hidden
        role="presentation"
      />
      <p className="text-sm text-muted-foreground" role="status">
        {t("auth.checkingSession")}
      </p>
    </div>
  );
}
