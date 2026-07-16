import { Navigate, Route, Routes } from "react-router";
import { PrivateRoute } from "@/components/private-route";
import { AppLayout } from "@/layouts/app-layout";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { PlaceholderPage } from "@/pages/placeholder-page";
import { SettingsPage } from "@/pages/settings/settings-page";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route
            path="calendar"
            element={<PlaceholderPage title="Calendar" />}
          />
          <Route
            path="reservations"
            element={<PlaceholderPage title="Reservations" />}
          />
          <Route
            path="check-in"
            element={<PlaceholderPage title="Check-in" />}
          />
          <Route path="units" element={<PlaceholderPage title="Units" />} />
          <Route path="reports" element={<PlaceholderPage title="Reports" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
