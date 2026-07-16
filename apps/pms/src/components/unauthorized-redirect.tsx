import { useEffect } from "react";
import { useNavigate } from "react-router";
import { setUnauthorizedHandler } from "@/lib/api";

/** Registers 401 → `/login` once a router is available. */
export function UnauthorizedRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void navigate("/login", { replace: true });
    });
    return () => {
      setUnauthorizedHandler(undefined);
    };
  }, [navigate]);

  return null;
}
