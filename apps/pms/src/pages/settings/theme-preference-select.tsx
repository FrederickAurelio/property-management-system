/* anchor: Linear settings row, diverge: three-way theme via Select */
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const themeOptions = [
  { value: "system", icon: MonitorIcon },
  { value: "light", icon: SunIcon },
  { value: "dark", icon: MoonIcon },
] as const;

export function ThemePreferenceSelect() {
  const { t } = useTranslation(["settings", "common"]);
  const { theme, setTheme } = useTheme();

  return (
    <Select
      value={theme ?? "system"}
      onValueChange={(value) => {
        if (value) setTheme(value);
      }}
    >
      <SelectTrigger
        className="w-40"
        aria-label={t("settings:appearance.themeSelectAriaLabel")}
      >
        <SelectValue
          placeholder={t("settings:appearance.themeSelectPlaceholder")}
        />
      </SelectTrigger>
      <SelectContent>
        {themeOptions.map(({ value, icon: Icon }) => (
          <SelectItem key={value} value={value}>
            <span className="flex items-center gap-2">
              <Icon />
              {t(`common:theme.${value}`)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
