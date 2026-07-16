import { Outlet } from "react-router";

/**
 * Authenticated app chrome.
 * Later: sidebar (desktop) + bottom nav (mobile). For now: route outlet only.
 */
export function AppLayout() {
  return (
    <div className="min-h-svh">
      <Outlet />
    </div>
  );
}
