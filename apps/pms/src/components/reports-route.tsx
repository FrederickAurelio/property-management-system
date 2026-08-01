import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router";
import { AuthLoading } from "@/components/auth-loading";
import { staffSession } from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";
import { canViewReports } from "@/lib/staff-permissions";

/** ADMIN / SUPER_ADMIN only — FRONT_DESK deep links redirect home. */
export function ReportsRoute() {
  const {
    data: staff,
    isPending,
    isSuccess,
  } = useQuery({
    queryKey: staffSessionQueryKey,
    queryFn: () => staffSession(),
    retry: false,
  });

  if (isPending) {
    return <AuthLoading />;
  }

  if (!isSuccess || !staff) {
    return <Navigate to="/login" replace />;
  }

  if (!canViewReports(staff.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
