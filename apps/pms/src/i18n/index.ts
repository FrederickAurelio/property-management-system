import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enAuth from "@/locales/en/auth.json";
import enCalendar from "@/locales/en/calendar.json";
import enCommon from "@/locales/en/common.json";
import enDashboard from "@/locales/en/dashboard.json";
import enErrors from "@/locales/en/errors.json";
import enInventory from "@/locales/en/inventory.json";
import enOta from "@/locales/en/ota.json";
import enReports from "@/locales/en/reports.json";
import enReservations from "@/locales/en/reservations.json";
import enSettings from "@/locales/en/settings.json";
import idAuth from "@/locales/id/auth.json";
import idCalendar from "@/locales/id/calendar.json";
import idCommon from "@/locales/id/common.json";
import idDashboard from "@/locales/id/dashboard.json";
import idErrors from "@/locales/id/errors.json";
import idInventory from "@/locales/id/inventory.json";
import idOta from "@/locales/id/ota.json";
import idReports from "@/locales/id/reports.json";
import idReservations from "@/locales/id/reservations.json";
import idSettings from "@/locales/id/settings.json";

export const pmsLocales = ["en", "id"] as const;
export type PmsLocale = (typeof pmsLocales)[number];

export const pmsNamespaces = [
  "common",
  "errors",
  "auth",
  "settings",
  "dashboard",
  "calendar",
  "inventory",
  "reports",
  "reservations",
  "ota",
] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        errors: enErrors,
        auth: enAuth,
        settings: enSettings,
        dashboard: enDashboard,
        calendar: enCalendar,
        inventory: enInventory,
        reports: enReports,
        reservations: enReservations,
        ota: enOta,
      },
      id: {
        common: idCommon,
        errors: idErrors,
        auth: idAuth,
        settings: idSettings,
        dashboard: idDashboard,
        calendar: idCalendar,
        inventory: idInventory,
        reports: idReports,
        reservations: idReservations,
        ota: idOta,
      },
    },
    fallbackLng: "en",
    supportedLngs: [...pmsLocales],
    defaultNS: "common",
    ns: [...pmsNamespaces],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "cabin-pms-locale",
    },
  });

// Guarded for non-DOM environments (e.g. Vitest `environment: "node"`).
if (typeof document !== "undefined") {
  i18n.on("languageChanged", (lng) => {
    document.documentElement.lang = lng;
  });
  document.documentElement.lang = i18n.resolvedLanguage ?? "en";
}

export default i18n;
