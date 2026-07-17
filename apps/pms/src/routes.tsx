import { Navigate, Route, Routes } from "react-router";
import { PrivateRoute } from "@/components/private-route";
import { AppLayout } from "@/layouts/app-layout";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { PlaceholderPage } from "@/pages/placeholder-page";
import { PropertiesPage } from "@/pages/properties/properties-page";
import { PropertyExplorerLayout } from "@/pages/properties/property-explorer-layout";
import { UnitTypesPage } from "@/pages/properties/unit-types-page";
import { UnitsPage } from "@/pages/properties/units-page";
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
          <Route path="properties" element={<PropertyExplorerLayout />}>
            <Route index element={<PropertiesPage />} />
            <Route path=":propertyId" element={<UnitTypesPage />} />
            <Route
              path=":propertyId/types/:unitTypeId"
              element={<UnitsPage />}
            />
          </Route>
          <Route path="units" element={<Navigate to="/properties" replace />} />
          <Route path="reports" element={<PlaceholderPage title="Reports" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
