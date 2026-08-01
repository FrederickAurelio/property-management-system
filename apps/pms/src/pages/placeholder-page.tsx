/* anchor: Linear-dense empty state, diverge: minimal copy until dashboard ships */
import { useTranslation } from "react-i18next";

export function PlaceholderPage({ title }: { title: string }) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground/80">
        {t("misc.comingSoon")}
      </p>
    </div>
  );
}
