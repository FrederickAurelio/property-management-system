import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  resetUnauthorizedStreak,
  setForceLogoutHandler,
  setSessionInvalidatedHandler,
  setUnauthorizedHandler,
} from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";
import { queryClient } from "@/lib/query-client";

/** Registers 401 → clear session cache → `/login` (debounced; full wipe after 3). */
export function UnauthorizedRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setSessionInvalidatedHandler(() => {
      queryClient.removeQueries({ queryKey: staffSessionQueryKey });
    });

    setForceLogoutHandler(() => {
      queryClient.clear();
      resetUnauthorizedStreak();
    });

    setUnauthorizedHandler(() => {
      if (location.pathname.startsWith("/login")) {
        return;
      }
      void navigate("/login", { replace: true });
    });

    return () => {
      setUnauthorizedHandler(undefined);
      setSessionInvalidatedHandler(undefined);
      setForceLogoutHandler(undefined);
    };
  }, [navigate, location.pathname]);

  return null;
}
