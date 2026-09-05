import { Navigate, Route, Routes } from "react-router";
import { PrivateRoute } from "@/components/private-route";
import { ReportsRoute } from "@/components/reports-route";
import { RequestLogsRoute } from "@/components/request-logs-route";
import { AppLayout } from "@/layouts/app-layout";
import { CalendarPage } from "@/pages/calendar/calendar-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { PropertiesPage } from "@/pages/properties/properties-page";
import { PropertyExplorerLayout } from "@/pages/properties/property-explorer-layout";
import { UnitTypesPage } from "@/pages/properties/unit-types-page";
import { UnitsPage } from "@/pages/properties/units-page";
import { ReportsPage } from "@/pages/reports/reports-page";
import { ExpensesPage } from "@/pages/expenses/expenses-page";
import { RequestLogsPage } from "@/pages/request-logs/request-logs-page";
import { ReservationDetailPage } from "@/pages/reservations/reservation-detail-page";
import { ReservationsPage } from "@/pages/reservations/reservations-page";
import { SettingsPage } from "@/pages/settings/settings-page";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route
            path="reservations/:reservationId"
            element={<ReservationDetailPage />}
          />
          <Route
            path="check-in"
            element={<Navigate to="/reservations?board=arrivals" replace />}
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
          <Route element={<ReportsRoute />}>
            <Route path="reports" element={<ReportsPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
          </Route>
          <Route element={<RequestLogsRoute />}>
            <Route path="request-logs" element={<RequestLogsPage />} />
          </Route>
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
