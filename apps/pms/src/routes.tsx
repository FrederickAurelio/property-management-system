import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router";
import { PrivateRoute } from "@/components/private-route";
import { ReportsRoute } from "@/components/reports-route";
import { RequestLogsRoute } from "@/components/request-logs-route";
import { AppLayout } from "@/layouts/app-layout";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";

const CalendarPage = lazy(() =>
  import("@/pages/calendar/calendar-page").then((m) => ({
    default: m.CalendarPage,
  })),
);
const ReservationsPage = lazy(() =>
  import("@/pages/reservations/reservations-page").then((m) => ({
    default: m.ReservationsPage,
  })),
);
const ReservationDetailPage = lazy(() =>
  import("@/pages/reservations/reservation-detail-page").then((m) => ({
    default: m.ReservationDetailPage,
  })),
);
const PropertyExplorerLayout = lazy(() =>
  import("@/pages/properties/property-explorer-layout").then((m) => ({
    default: m.PropertyExplorerLayout,
  })),
);
const PropertiesPage = lazy(() =>
  import("@/pages/properties/properties-page").then((m) => ({
    default: m.PropertiesPage,
  })),
);
const UnitTypesPage = lazy(() =>
  import("@/pages/properties/unit-types-page").then((m) => ({
    default: m.UnitTypesPage,
  })),
);
const UnitsPage = lazy(() =>
  import("@/pages/properties/units-page").then((m) => ({
    default: m.UnitsPage,
  })),
);
const ReportsPage = lazy(() =>
  import("@/pages/reports/reports-page").then((m) => ({
    default: m.ReportsPage,
  })),
);
const ExpensesPage = lazy(() =>
  import("@/pages/expenses/expenses-page").then((m) => ({
    default: m.ExpensesPage,
  })),
);
const RequestLogsPage = lazy(() =>
  import("@/pages/request-logs/request-logs-page").then((m) => ({
    default: m.RequestLogsPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings/settings-page").then((m) => ({
    default: m.SettingsPage,
  })),
);

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
