/* anchor: Linear-dense detail, diverge: Sheet desktop / bottom Sheet mobile */
import type { StaffRequestLogItem } from "@cabin/api-contract";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

type RequestLogsDetailSheetProps = {
  row: StaffRequestLogItem | null;
  onOpenChange: (open: boolean) => void;
  formatTime: (iso: string) => string;
};

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          mono ? "min-w-0 font-mono text-xs break-all" : "min-w-0 break-all"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function RequestLogsDetailSheet({
  row,
  onOpenChange,
  formatTime,
}: RequestLogsDetailSheetProps) {
  const { t } = useTranslation(["request-logs", "common"]);
  const isMobile = useIsMobile();

  return (
    <Sheet open={row !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "flex max-h-[90svh] flex-col" : undefined}
      >
        <SheetHeader>
          <SheetTitle>{t("request-logs:detail.title")}</SheetTitle>
          <SheetDescription className="sr-only">
            {row ? `${row.method} ${row.path}` : ""}
          </SheetDescription>
        </SheetHeader>
        {row && (
          <dl className="flex flex-col gap-3 px-4 pb-4">
            <DetailRow
              label={t("request-logs:detail.time")}
              value={formatTime(row.time)}
            />
            <DetailRow
              label={t("request-logs:detail.user")}
              value={row.actor}
            />
            <DetailRow label={t("request-logs:detail.app")} value={row.app} />
            <DetailRow
              label={t("request-logs:detail.audience")}
              value={row.audience}
            />
            <DetailRow
              label={t("request-logs:detail.method")}
              value={row.method}
            />
            <DetailRow
              label={t("request-logs:detail.path")}
              value={row.path}
              mono
            />
            <DetailRow
              label={t("request-logs:detail.status")}
              value={String(row.status)}
            />
            <DetailRow
              label={t("request-logs:detail.duration")}
              value={t("request-logs:detail.ms", { ms: row.durationMs })}
            />
            <DetailRow
              label={t("request-logs:detail.requestId")}
              value={row.requestId}
              mono
            />
            {row.errorCode && (
              <DetailRow
                label={t("request-logs:detail.errorCode")}
                value={row.errorCode}
                mono
              />
            )}
            {row.errorMessage && (
              <DetailRow
                label={t("request-logs:detail.errorMessage")}
                value={row.errorMessage}
              />
            )}
          </dl>
        )}
      </SheetContent>
    </Sheet>
  );
}
