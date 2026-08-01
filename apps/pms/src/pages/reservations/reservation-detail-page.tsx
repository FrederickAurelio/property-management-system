/* anchor: Linear-dense detail, diverge: money always on + confirm before ops CTAs */
import { useState } from "react";
import { IcalSyncWarning } from "@cabin/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { ArrowLeftIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router";
import { toast } from "sonner";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  acceptIcalDates,
  acceptIcalUnit,
  checkInReservation,
  checkOutReservation,
  confirmReservation,
  dismissIcalWarning,
  getReservation,
  handleError,
  handleSuccess,
  staffReservationQueryKey,
  syncReservationCaches,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { CancelSheet } from "./cancel-sheet";
import { CollectSheet } from "./collect-sheet";
import { IcalPlaybookCard } from "./ical-playbook-card";
import { isOtaLinkedStay } from "@/lib/ota-channels";
import {
  icalActionConfirmCopy,
  icalPlaybook,
  type IcalPendingAction,
} from "./ical-playbooks";
import { useOtaRemindDialog } from "@/hooks/use-ota-remind-dialog";
import { PaymentMovementsTimeline } from "./payment-movements-timeline";
import { ReservationBadge, SourceBadge } from "./reservation-badges";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { ReservationMoneyBlock } from "./reservation-money-block";
import { reservationDetailBackHref } from "./reservation-nav";
import {
  confirmReadinessFromReservation,
  formatConfirmGapsMessage,
  formatReservationLateCue,
  formatReservationSource,
  formatReservationStatus,
  formatStayRange,
  canCollectPayment,
  canEditStay,
  isCheckInWindow,
  isTerminalStatus,
  primaryActionButtonClass,
  primaryActionFor,
  primaryActionLabel,
  reservationDue,
  reservationLateCue,
  reservationRefund,
  collectPaymentLabel,
  statusBadgeTone,
  todayYmdInTimezone,
  type PrimaryAction,
} from "./reservation-format";
import { ReservationSource, type StaffReservation } from "@cabin/api-contract";

function primaryActionDialogCopy(
  t: TFunction<"reservations">,
  action: PrimaryAction,
  row: StaffReservation,
  today: string,
): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  switch (action) {
    case "confirm":
      return {
        title: t("detailPage.primaryDialogs.confirmTitle"),
        description: t("detailPage.primaryDialogs.confirmDescription"),
        confirmLabel: t("detailPage.primaryDialogs.confirmLabel"),
      };
    case "check-in": {
      const early = !isCheckInWindow(row, today);
      return {
        title: early
          ? t("detailPage.primaryDialogs.checkInEarlyTitle")
          : t("detailPage.primaryDialogs.checkInTitle"),
        description: early
          ? t("detailPage.primaryDialogs.checkInEarlyDescription", {
              checkIn: row.checkInDate,
              checkOut: row.checkOutDate,
            })
          : t("detailPage.primaryDialogs.checkInDescription"),
        confirmLabel: early
          ? t("detailPage.primaryDialogs.checkInEarlyLabel")
          : t("detailPage.primaryDialogs.checkInLabel"),
      };
    }
    case "check-out": {
      const due =
        row.totalAmountIdr == null
          ? null
          : Math.max(row.totalAmountIdr - row.paidAmountIdr, 0);
      const unpaid = due != null && due > 0;
      const offDay = row.checkOutDate !== today;
      return {
        title: offDay
          ? row.checkOutDate > today
            ? t("detailPage.primaryDialogs.checkOutEarlyTitle")
            : t("detailPage.primaryDialogs.checkOutLateTitle")
          : t("detailPage.primaryDialogs.checkOutTitle"),
        description: unpaid
          ? t("detailPage.primaryDialogs.checkOutUnpaidDescription")
          : t("detailPage.primaryDialogs.checkOutPaidDescription"),
        confirmLabel: offDay
          ? row.checkOutDate > today
            ? t("detailPage.primaryDialogs.checkOutEarlyLabel")
            : t("detailPage.primaryDialogs.checkOutLateLabel")
          : t("detailPage.primaryDialogs.checkOutLabel"),
      };
    }
  }
}

export function ReservationDetailPage() {
  const { t } = useTranslation(["reservations", "common"]);
  const { reservationId = "" } = useParams();
  const location = useLocation();
  const backHref = reservationDetailBackHref(location.state);
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editIntent, setEditIntent] = useState<"edit" | "confirm-enrich">(
    "edit",
  );
  const [pendingPrimary, setPendingPrimary] = useState<PrimaryAction | null>(
    null,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const { showRefreshImports, showSourceRemind, remindDialog } =
    useOtaRemindDialog();
  const [pendingIcal, setPendingIcal] = useState<IcalPendingAction | null>(
    null,
  );

  const detailQuery = useQuery({
    queryKey: staffReservationQueryKey(reservationId),
    queryFn: () => getReservation(reservationId),
    enabled: Boolean(reservationId),
  });

  const primaryMutation = useMutation({
    mutationFn: async (action: PrimaryAction) => {
      const current = detailQuery.data;
      if (!current) {
        throw new Error(t("detailPage.notLoaded"));
      }
      const today = todayYmdInTimezone(current.propertyTimezone);
      switch (action) {
        case "confirm":
          return confirmReservation(reservationId);
        case "check-in": {
          const needsConfirm = !isCheckInWindow(current, today);
          return checkInReservation(reservationId, {
            confirmEarly: needsConfirm || undefined,
          });
        }
        case "check-out": {
          const earlyOrLate = current.checkOutDate !== today;
          return checkOutReservation(reservationId, {
            confirmEarly: earlyOrLate || undefined,
          });
        }
      }
    },
    onSuccess: (saved, action) => {
      setPendingPrimary(null);
      syncReservationCaches(queryClient, saved, {
        occupancyChanged: action === "check-out",
      });
      handleSuccess(
        action === "confirm"
          ? t("detailPage.toastConfirmed")
          : action === "check-in"
            ? t("detailPage.toastCheckedIn")
            : t("detailPage.toastCheckedOut"),
      );
      if (action === "confirm") {
        showRefreshImports({
          trigger: "confirm",
          unitId: saved.unitId,
          bookingSource: saved.source,
        });
      }
      if (action === "check-out" && isOtaLinkedStay(saved)) {
        showSourceRemind(saved.source, "check-out");
      }
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const icalMutation = useMutation({
    mutationFn: async (action: "accept-dates" | "accept-unit" | "dismiss") => {
      if (action === "accept-dates") {
        return acceptIcalDates(reservationId);
      }
      if (action === "accept-unit") {
        return acceptIcalUnit(reservationId);
      }
      return dismissIcalWarning(reservationId);
    },
    onSuccess: (saved, action) => {
      setPendingIcal(null);
      syncReservationCaches(queryClient, saved, {
        occupancyChanged: action === "accept-dates" || action === "accept-unit",
      });
      handleSuccess(
        action === "accept-dates"
          ? t("detailPage.toastOtaDatesApplied")
          : action === "accept-unit"
            ? t("detailPage.toastMovedToOtaUnit")
            : t("detailPage.toastOtaWarningDismissed"),
      );
    },
    onError: (error) => {
      handleError(error);
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 md:p-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          asChild
          className="w-fit"
        >
          <Link to={backHref}>
            <ArrowLeftIcon data-icon="inline-start" />
            {t("detailPage.back")}
          </Link>
        </Button>
        <QueryErrorPanel
          message={t("detailPage.loadError")}
          onRetry={() => {
            void detailQuery.refetch();
          }}
          isRetrying={detailQuery.isFetching}
        />
      </div>
    );
  }

  const row = detailQuery.data;
  const today = todayYmdInTimezone(row.propertyTimezone);
  const lateCue = reservationLateCue(row);
  const primary = primaryActionFor(row);
  const due = reservationDue(row);
  const refund = reservationRefund(row);
  const editable = canEditStay(row.status);
  const showCollect = canCollectPayment(row);
  const showDueWarn = due != null && due > 0 && showCollect;
  const showRefundWarn = refund != null && refund > 0 && showCollect;
  const showIcalWarn = row.icalSyncWarning != null;
  const pendingCopy = pendingPrimary
    ? primaryActionDialogCopy(t, pendingPrimary, row, today)
    : null;
  const icalPlaybookForRow =
    row.icalSyncWarning != null
      ? icalPlaybook(row.icalSyncWarning, {
          source: row.source,
          unitCode: row.unitCode,
          checkInDate: row.checkInDate,
          checkOutDate: row.checkOutDate,
          statusLabel: formatReservationStatus(row.status),
          icalObservedUnitCode: row.icalObservedUnitCode,
          icalObservedCheckInDate: row.icalObservedCheckInDate,
          icalObservedCheckOutDate: row.icalObservedCheckOutDate,
        })
      : null;
  const pendingIcalCopy = pendingIcal
    ? icalActionConfirmCopy(pendingIcal, {
        source: row.source,
        unitCode: row.unitCode,
        checkInDate: row.checkInDate,
        checkOutDate: row.checkOutDate,
        icalObservedUnitCode: row.icalObservedUnitCode,
        icalObservedCheckInDate: row.icalObservedCheckInDate,
        icalObservedCheckOutDate: row.icalObservedCheckOutDate,
        dismissLabel: icalPlaybookForRow?.dismissLabel,
        checked: row.icalSyncWarning === IcalSyncWarning.OTA_STILL_LISTED,
      })
    : null;

  const requestPrimary = (action: PrimaryAction) => {
    if (action === "confirm") {
      const gaps = confirmReadinessFromReservation(row);
      if (gaps.length > 0) {
        toast.message(t("detailPage.toastCompleteDetailsFirst"), {
          description: formatConfirmGapsMessage(gaps),
        });
        setEditIntent("confirm-enrich");
        setEditOpen(true);
        return;
      }
    }
    setPendingPrimary(action);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to={backHref}>
            <ArrowLeftIcon data-icon="inline-start" />
            {t("detailPage.back")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {row.guestName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("detailPage.unitAtProperty", {
              unitCode: row.unitCode,
              propertyName: row.propertyName,
            })}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatStayRange(
              row.checkInDate,
              row.checkOutDate,
              row.billingPeriod,
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ReservationBadge
              label={formatReservationStatus(row.status)}
              tone={statusBadgeTone(row.status)}
            />
            <SourceBadge
              source={row.source}
              label={formatReservationSource(row.source)}
            />
            {lateCue && (
              <ReservationBadge
                label={formatReservationLateCue(lateCue)}
                tone="warn"
              />
            )}
          </div>
          {(row.guestPhone || row.guestEmail) && (
            <p className="mt-3 text-sm text-muted-foreground">
              {[row.guestPhone, row.guestEmail].filter(Boolean).join(" · ")}
              {row.guestCount != null &&
                t("detailPage.guestCountSuffix", { count: row.guestCount })}
            </p>
          )}
          {(row.createdByAdminUsername || row.updatedByAdminUsername) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {row.createdByAdminUsername
                ? t("detailPage.createdByAdmin", {
                    admin: row.createdByAdminUsername,
                  })
                : t("detailPage.createdBySystem")}
              {row.updatedByAdminUsername &&
                t("detailPage.lastUpdatedBy", {
                  admin: row.updatedByAdminUsername,
                })}
            </p>
          )}
          {row.notes && (
            <p className="mt-2 text-sm whitespace-pre-wrap">{row.notes}</p>
          )}
        </div>

        <ReservationMoneyBlock
          reservation={row}
          className="w-full shrink-0 md:w-80"
        />
      </div>

      {(showDueWarn || showRefundWarn || showIcalWarn) && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {showIcalWarn && row.icalSyncWarning && icalPlaybookForRow && (
            <IcalPlaybookCard
              playbook={icalPlaybookForRow}
              channelLabel={
                row.source === ReservationSource.BOOKING_COM ||
                row.source === ReservationSource.AIRBNB ||
                row.source === ReservationSource.AGODA
                  ? formatReservationSource(row.source)
                  : "OTA"
              }
              pending={icalMutation.isPending}
              onPrimary={(kind) => {
                if (kind === "cancel") {
                  setCancelOpen(true);
                  return;
                }
                if (kind === "confirm") {
                  requestPrimary("confirm");
                  return;
                }
                if (kind === "accept-dates") {
                  setPendingIcal("accept-dates");
                  return;
                }
                if (kind === "accept-unit") {
                  setPendingIcal("accept-unit");
                  return;
                }
                if (kind === "clear-hold") {
                  setPendingIcal("clear-hold");
                }
              }}
              onDismiss={() => {
                setPendingIcal("dismiss");
              }}
            />
          )}
          {showRefundWarn && <p>{t("detailPage.warnOverpaid")}</p>}
          {showDueWarn && !showRefundWarn && (
            <p>
              {isTerminalStatus(row.status)
                ? t("detailPage.warnDueTerminal")
                : t("detailPage.warnDueLive")}
            </p>
          )}
        </div>
      )}

      <PaymentMovementsTimeline reservation={row} />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {primary && (
          <Button
            type="button"
            className={cn(primaryActionButtonClass(primary))}
            disabled={primaryMutation.isPending}
            onClick={() => {
              requestPrimary(primary);
            }}
          >
            {primaryActionLabel(primary)}
          </Button>
        )}
        {editable && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditIntent("edit");
              setEditOpen(true);
            }}
          >
            {t("detailPage.buttons.edit")}
          </Button>
        )}
        {showCollect && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCollectOpen(true);
            }}
          >
            {collectPaymentLabel(row)}
          </Button>
        )}
        {editable && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCancelOpen(true);
            }}
          >
            {t("detailPage.buttons.cancel")}
          </Button>
        )}
      </div>

      <ReservationFormDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditIntent("edit");
          }
        }}
        reservation={row}
        intent={editIntent}
        onSaved={(saved) => {
          if (editIntent !== "confirm-enrich") {
            return;
          }
          const gaps = confirmReadinessFromReservation(saved);
          if (gaps.length > 0) {
            toast.message(t("detailPage.toastStillMissingDetails"), {
              description: formatConfirmGapsMessage(gaps),
            });
            return;
          }
          setPendingPrimary("confirm");
        }}
      />

      <CollectSheet
        open={collectOpen}
        onOpenChange={setCollectOpen}
        reservation={row}
      />

      <CancelSheet
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        reservation={row}
      />

      {remindDialog}

      {pendingIcalCopy && pendingIcal && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !icalMutation.isPending) {
              setPendingIcal(null);
            }
          }}
          title={pendingIcalCopy.title}
          description={pendingIcalCopy.description}
          confirmLabel={pendingIcalCopy.confirmLabel}
          cancelLabel={t("detailPage.goBack")}
          confirmDisabled={icalMutation.isPending}
          onConfirm={() => {
            if (pendingIcal === "accept-dates") {
              icalMutation.mutate("accept-dates");
              return;
            }
            if (pendingIcal === "accept-unit") {
              icalMutation.mutate("accept-unit");
              return;
            }
            icalMutation.mutate("dismiss");
          }}
        />
      )}

      {pendingCopy && pendingPrimary && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingPrimary(null);
            }
          }}
          title={pendingCopy.title}
          description={pendingCopy.description}
          confirmLabel={pendingCopy.confirmLabel}
          cancelLabel={t("detailPage.goBack")}
          confirmClassName={primaryActionButtonClass(pendingPrimary)}
          confirmDisabled={primaryMutation.isPending}
          onConfirm={() => {
            primaryMutation.mutate(pendingPrimary);
          }}
        />
      )}
    </div>
  );
}
