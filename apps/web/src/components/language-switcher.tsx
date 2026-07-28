import { useTranslation } from "react-i18next";

import { webLocales, type WebLocale } from "@/i18n";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "en").slice(0, 2) as WebLocale;

  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label={t("language.label")}
    >
      {webLocales.map((locale) => (
        <Button
          key={locale}
          type="button"
          size="xs"
          variant={current === locale ? "secondary" : "ghost"}
          onClick={() => {
            void i18n.changeLanguage(locale);
          }}
        >
          {t(`language.${locale}`)}
        </Button>
      ))}
    </div>
  );
}
