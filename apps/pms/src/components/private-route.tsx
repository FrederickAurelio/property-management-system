import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router";
import { AuthLoading } from "@/components/auth-loading";
import { staffSession } from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";

/**
 * Auth gate for the app shell. Renders child routes when session check succeeds.
 */
export function PrivateRoute() {
  const { isPending, isSuccess } = useQuery({
    queryKey: staffSessionQueryKey,
    queryFn: () => staffSession(),
    retry: false,
  });

  if (isPending) {
    return <AuthLoading />;
  }

  if (!isSuccess) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
