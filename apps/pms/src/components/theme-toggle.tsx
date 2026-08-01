import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** Toggles between light and dark. Persists via `next-themes` (localStorage). */
export function ThemeToggle() {
  const { t } = useTranslation(["common"]);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={isDark ? t("theme.switchToLight") : t("theme.switchToDark")}
      onClick={() => {
        setTheme(isDark ? "light" : "dark");
      }}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
