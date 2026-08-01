import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { pmsLocales, type PmsLocale } from "@/i18n";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
  size?: "xs" | "sm";
};

export function LanguageSwitcher({
  className,
  size = "xs",
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation("common");
  const current = (i18n.resolvedLanguage ?? "en").slice(0, 2) as PmsLocale;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label={t("language.label")}
    >
      {pmsLocales.map((locale) => (
        <Button
          key={locale}
          type="button"
          size={size}
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
