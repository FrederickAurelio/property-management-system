import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en/common.json";
import id from "@/locales/id/common.json";
import zh from "@/locales/zh/common.json";

export const webLocales = ["en", "id", "zh"] as const;
export type WebLocale = (typeof webLocales)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      id: { common: id },
      zh: { common: zh },
    },
    fallbackLng: "en",
    supportedLngs: [...webLocales],
    defaultNS: "common",
    ns: ["common"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "cabin-web-locale",
    },
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng === "zh" ? "zh-CN" : lng;
});

export default i18n;
