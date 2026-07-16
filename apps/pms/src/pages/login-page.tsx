import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";
import { AuthLoading } from "@/components/auth-loading";
import { staffSession } from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";

export function LoginPage() {
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

  return <div className="min-h-svh" />;
}
