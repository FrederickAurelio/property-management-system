import { useTranslation } from "react-i18next";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium tracking-tight">
          {t("appName")}
        </span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-16 mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("home.title")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("home.subtitle")}
        </p>
        <div>
          <Button type="button">{t("home.cta")}</Button>
        </div>
      </main>
    </div>
  );
}
