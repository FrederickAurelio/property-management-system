/* anchor: Linear session login / Stripe sign-in, diverge: Outfit wordmark + warm primary CTA */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { AuthLoading } from "@/components/auth-loading";
import { PreferencesPopover } from "@/components/preferences-popover";
import { Card, CardContent } from "@/components/ui/card";
import { staffSession } from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";
import { LoginForm } from "@/pages/login-form";

export function LoginPage() {
  const { t } = useTranslation(["auth"]);
  const { isPending, isSuccess } = useQuery({
    queryKey: staffSessionQueryKey,
    queryFn: () => staffSession({ skipUnauthorizedRedirect: true }),
    retry: false,
  });

  if (isPending) {
    return <AuthLoading />;
  }

  if (isSuccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="absolute top-4 right-4">
        <PreferencesPopover />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            {t("signInHeading")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("signInSubtitle")}</p>
        </div>

        <Card size="sm">
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
