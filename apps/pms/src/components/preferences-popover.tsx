/* anchor: Linear preferences menu / Notion workspace switcher, diverge: theme + locale only, segmented + radio */
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  Settings2Icon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { pmsLocales, type PmsLocale } from "@/i18n";
import { cn } from "@/lib/utils";

type ThemeValue = "light" | "system" | "dark";

const themeOptions: {
  value: ThemeValue;
  icon: LucideIcon;
  labelKey: "theme.light" | "theme.system" | "theme.dark";
}[] = [
  { value: "light", icon: SunIcon, labelKey: "theme.light" },
  { value: "system", icon: MonitorIcon, labelKey: "theme.system" },
  { value: "dark", icon: MoonIcon, labelKey: "theme.dark" },
];

function ThemeSegment({
  active,
  onSelect,
  label,
  Icon,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
  Icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent text-xs font-medium transition-colors",
        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-hidden",
        active
          ? "border-border bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </button>
  );
}

function LanguageRadio({
  active,
  onSelect,
  label,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-sm transition-colors",
        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-hidden",
        "hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "truncate",
          active ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {active && <CheckIcon className="size-4 shrink-0 text-foreground" />}
    </button>
  );
}

export function PreferencesPopover({
  align = "end",
  sideOffset = 6,
}: {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  const { t, i18n } = useTranslation("common");
  const { theme, setTheme } = useTheme();
  const currentLocale = (i18n.resolvedLanguage ?? "en").slice(
    0,
    2,
  ) as PmsLocale;
  const currentTheme: ThemeValue =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("preferences.open")}
        >
          <Settings2Icon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={sideOffset}
        className="w-64 p-0"
      >
        <PopoverHeader className="border-b border-border px-3 py-2.5">
          <PopoverTitle>{t("preferences.title")}</PopoverTitle>
          <PopoverDescription>
            {t("preferences.description")}
          </PopoverDescription>
        </PopoverHeader>

        <div className="flex flex-col gap-3 p-2.5">
          <div className="flex flex-col gap-1.5">
            <p className="px-1 text-xs font-medium text-muted-foreground">
              {t("preferences.themeGroup")}
            </p>
            <div
              role="radiogroup"
              aria-label={t("preferences.themeGroup")}
              className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
            >
              {themeOptions.map((option) => (
                <ThemeSegment
                  key={option.value}
                  active={currentTheme === option.value}
                  onSelect={() => {
                    setTheme(option.value);
                  }}
                  label={t(option.labelKey)}
                  Icon={option.icon}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="px-1 text-xs font-medium text-muted-foreground">
              {t("preferences.languageGroup")}
            </p>
            <div
              role="radiogroup"
              aria-label={t("preferences.languageGroup")}
              className="flex flex-col"
            >
              {pmsLocales.map((locale) => (
                <LanguageRadio
                  key={locale}
                  active={currentLocale === locale}
                  onSelect={() => {
                    void i18n.changeLanguage(locale);
                  }}
                  label={t(`language.${locale}`)}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
