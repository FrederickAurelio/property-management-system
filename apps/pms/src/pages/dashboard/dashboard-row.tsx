/* anchor: Linear issues list / Reservations desk table, diverge: triage columns — one signal, money right */
import { Link } from "react-router";
import { AlertTriangleIcon } from "lucide-react";
import type {
  StaffDashboardAttentionKind,
  StaffReservationListItem,
} from "@cabin/api-contract";
import { isPlaceholderGuestName } from "@cabin/api-contract";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { ReservationBadge } from "@/pages/reservations/reservation-badges";
import {
  formatIcalWarning,
  formatReservationBalanceCell,
  formatReservationLateCue,
  reservationLateCue,
  type ReservationLateCue,
} from "@/pages/reservations/reservation-format";
import { reservationDashboardStateFromSearch } from "@/pages/reservations/reservation-nav";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { primaryAttentionLabel } from "./dashboard-format";

type StayListProps = {
  items: StaffReservationListItem[];
  dashboardSearch: string;
  opsDate: string;
  /** Needs attention rows carry kinds; arrivals/departures omit. */
  attentionById?: Record<string, StaffDashboardAttentionKind[] | undefined>;
  showWhyColumn?: boolean;
};

function lateCueForOpsDate(
  row: StaffReservationListItem,
  opsDate: string,
): ReservationLateCue | null {
  const cue = reservationLateCue(row);
  if (cue) return cue;
  if (
    row.status === "CONFIRMED" &&
    row.checkInDate < opsDate &&
    opsDate < row.checkOutDate
  ) {
    return "arrival";
  }
  if (row.status === "CHECKED_IN" && row.checkOutDate < opsDate) {
    return "departure";
  }
  return null;
}

function guestLabel(row: StaffReservationListItem): string {
  return isPlaceholderGuestName(row.guestName)
    ? i18n.t("dashboard:row.needsDetails")
    : row.guestName;
}

function GuestSignals({
  row,
  lateCue,
}: {
  row: StaffReservationListItem;
  lateCue: ReservationLateCue | null;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="truncate text-sm font-medium">{guestLabel(row)}</span>
      {lateCue && (
        <ReservationBadge
          label={formatReservationLateCue(lateCue)}
          tone="warn"
          className="shrink-0"
        />
      )}
      {row.icalSyncWarning && (
        <AlertTriangleIcon
          className="size-3.5 shrink-0 text-amber-700 dark:text-amber-300"
          aria-label={formatIcalWarning(row.icalSyncWarning, row.source)}
        />
      )}
    </span>
  );
}

function MobileStayCard({
  row,
  dashboardSearch,
  opsDate,
  attentionKinds,
  showWhy,
}: {
  row: StaffReservationListItem;
  dashboardSearch: string;
  opsDate: string;
  attentionKinds?: StaffDashboardAttentionKind[];
  showWhy: boolean;
}) {
  const lateCue = lateCueForOpsDate(row, opsDate);
  const balance = formatReservationBalanceCell(row);
  const why = showWhy
    ? primaryAttentionLabel(attentionKinds, balance.kind)
    : null;
  const showMoney = balance.kind === "due" || balance.kind === "refund";

  return (
    <Link
      to={`/reservations/${row.id}`}
      state={reservationDashboardStateFromSearch(dashboardSearch)}
      className={cn(
        "flex min-h-11 flex-col gap-1.5 border-b border-border px-3 py-2.5 last:border-b-0",
        "transition-colors hover:bg-muted/40 active:bg-muted/60",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <GuestSignals row={row} lateCue={lateCue} />
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.unitCode}
          </p>
        </div>
        <p
          className={cn(
            "shrink-0 text-xs tabular-nums",
            showMoney &&
              balance.kind === "refund" &&
              "text-amber-800 dark:text-amber-200",
            showMoney && balance.kind === "due" && "text-foreground",
            !showMoney && "text-muted-foreground",
          )}
        >
          {showMoney ? balance.text : "—"}
        </p>
      </div>
      {why && <ReservationBadge label={why.label} tone={why.tone} />}
    </Link>
  );
}

function DesktopStayTable({
  items,
  dashboardSearch,
  opsDate,
  attentionById,
  showWhyColumn,
}: StayListProps) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 pl-3">
              {t("dashboard:table.guest")}
            </TableHead>
            <TableHead className="h-9">{t("dashboard:table.unit")}</TableHead>
            {showWhyColumn && (
              <TableHead className="h-9">{t("dashboard:table.why")}</TableHead>
            )}
            <TableHead className="h-9 pr-3 text-right">
              {t("dashboard:table.due")}
            </TableHead>
            <TableHead className="w-0 p-0">
              <span className="sr-only">{t("dashboard:table.openSr")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => {
            const lateCue = lateCueForOpsDate(row, opsDate);
            const balance = formatReservationBalanceCell(row);
            const kinds = attentionById?.[row.id];
            const why = showWhyColumn
              ? primaryAttentionLabel(kinds, balance.kind)
              : null;
            const showMoney =
              balance.kind === "due" || balance.kind === "refund";

            return (
              <TableRow key={row.id} className="relative hover:bg-muted/40">
                <TableCell className="max-w-[14rem] py-2.5 pl-3">
                  <GuestSignals row={row} lateCue={lateCue} />
                </TableCell>
                <TableCell className="py-2.5 text-sm text-muted-foreground">
                  {row.unitCode}
                </TableCell>
                {showWhyColumn && (
                  <TableCell className="py-2.5">
                    {why ? (
                      <ReservationBadge label={why.label} tone={why.tone} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell
                  className={cn(
                    "py-2.5 pr-3 text-right text-sm tabular-nums",
                    showMoney &&
                      balance.kind === "refund" &&
                      "text-amber-800 dark:text-amber-200",
                    !showMoney && "text-muted-foreground",
                  )}
                >
                  {showMoney ? balance.text : "—"}
                </TableCell>
                <TableCell className="w-0 p-0">
                  <Link
                    to={`/reservations/${row.id}`}
                    state={reservationDashboardStateFromSearch(dashboardSearch)}
                    className="absolute inset-0"
                    aria-label={t("dashboard:row.openReservationFor", {
                      guest: guestLabel(row),
                    })}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function DashboardStayList(props: StayListProps) {
  const isMobile = useIsMobile();
  const showWhy = Boolean(props.showWhyColumn);

  if (isMobile) {
    return (
      <ul className="flex flex-col">
        {props.items.map((row) => (
          <li key={row.id}>
            <MobileStayCard
              row={row}
              dashboardSearch={props.dashboardSearch}
              opsDate={props.opsDate}
              attentionKinds={props.attentionById?.[row.id]}
              showWhy={showWhy}
            />
          </li>
        ))}
      </ul>
    );
  }

  return <DesktopStayTable {...props} />;
}
