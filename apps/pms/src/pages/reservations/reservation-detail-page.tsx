/* anchor: Linear-dense detail / Stripe-data money, diverge: titled Stay+Guest dl + ranked ops toolbar */
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
import { Separator } from "@/components/ui/separator";
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
import {
  DetailDl,
  DetailDlRow,
  ReservationDetailSection,
} from "./reservation-detail-section";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { ReservationMoneyBlock } from "./reservation-money-block";
import { reservationDetailBackHref } from "./reservation-nav";
import {
  confirmReadinessFromReservation,
  formatConfirmGapsMessage,
  formatDateYmd,
  formatIdr,
  formatReservationLateCue,
  formatReservationSource,
  formatReservationStatus,
  canCollectPayment,
  canCancelStay,
  canEditStay,
  canRefundPayment,
  isCheckInWindow,
  isTerminalStatus,
  primaryActionButtonClass,
  primaryActionFor,
  primaryActionLabel,
  reservationDue,
  reservationLateCue,
  statusBadgeTone,
  StayBillingPeriod,
  todayYmdInTimezone,
  type PrimaryAction,
} from "./reservation-format";
import { UtilitiesSheet } from "./utilities-sheet";
import {
  ReservationSource,
  ReservationStatus,
  moneyGapKind,
  refundDueIdr,
  type StaffReservation,
} from "@cabin/api-contract";

function billingPeriodLabel(
  t: TFunction<"reservations">,
  period: StaffReservation["billingPeriod"],
): string {
  if (period === StayBillingPeriod.MONTHLY) {
    return t("stayDatePicker.periodToggle.monthly");
  }
  if (period === StayBillingPeriod.YEARLY) {
    return t("stayDatePicker.periodToggle.yearly");
  }
  return t("stayDatePicker.periodToggle.daily");
}

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
      const credit = refundDueIdr(row.totalAmountIdr, row.paidAmountIdr) ?? 0;
      const offDay = row.checkOutDate !== today;
      const baseDescription = unpaid
        ? t("detailPage.primaryDialogs.checkOutUnpaidDescription")
        : credit > 0
          ? t("detailPage.primaryDialogs.checkOutCreditDescription", {
              amount: formatIdr(credit),
            })
          : t("detailPage.primaryDialogs.checkOutPaidDescription");
      return {
        title: offDay
          ? row.checkOutDate > today
            ? t("detailPage.primaryDialogs.checkOutEarlyTitle")
            : t("detailPage.primaryDialogs.checkOutLateTitle")
          : t("detailPage.primaryDialogs.checkOutTitle"),
        description: row.utilitiesDueNotice
          ? `${baseDescription} ${t(
              "detailPage.primaryDialogs.checkOutUtilitiesDue",
            )}`
          : baseDescription,
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
  const [cancelSession, setCancelSession] = useState(0);
  const [collectIntent, setCollectIntent] = useState<
    "collect" | "refund" | null
  >(null);
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);
  const [utilitiesSession, setUtilitiesSession] = useState(0);
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
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 pt-6 pb-16 md:gap-8 md:p-6 md:pt-8 md:pb-20">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 pt-6 pb-16 md:gap-8 md:p-6 md:pt-8 md:pb-20">
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
  const editable = canEditStay(row.status);
  const cancellable = canCancelStay(row.status);
  const showCollect = canCollectPayment(row);
  const showRefundCta = canRefundPayment(row);
  const showUtilities = row.status !== ReservationStatus.CANCELLED;
  const moneyKind = moneyGapKind(row);
  const showDueWarn = due != null && due > 0 && showCollect;
  const showRefundWarn = moneyKind === "refund";
  const showIcalWarn = row.icalSyncWarning != null;
  const utilitiesMonthLabel = row.utilitiesNextDueDate
    ? formatDateYmd(row.utilitiesNextDueDate)
    : null;
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

  const hasGuestContact = Boolean(row.guestPhone || row.guestEmail);
  const hasMeta = Boolean(
    row.createdByAdminUsername || row.updatedByAdminUsername,
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 pt-6 pb-16 md:gap-8 md:p-6 md:pt-8 md:pb-20">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to={backHref}>
              <ArrowLeftIcon data-icon="inline-start" />
              {t("detailPage.back")}
            </Link>
          </Button>
        </div>

        <header className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {row.guestName}
          </h1>
          <div className="flex flex-wrap gap-1.5">
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
        </header>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-10">
        <ReservationMoneyBlock
          reservation={row}
          className="w-full shrink-0 md:sticky md:top-4 md:order-2 md:w-72"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4 md:order-1">
          <ReservationDetailSection title={t("detailPage.sections.stay")}>
            <DetailDl>
              <DetailDlRow label={t("detailPage.rows.unit")}>
                {row.unitCode}
              </DetailDlRow>
              <DetailDlRow label={t("detailPage.rows.property")}>
                {row.propertyName}
              </DetailDlRow>
              <DetailDlRow label={t("detailPage.rows.checkIn")}>
                {formatDateYmd(row.checkInDate)}
              </DetailDlRow>
              <DetailDlRow label={t("detailPage.rows.checkOut")}>
                {formatDateYmd(row.checkOutDate)}
              </DetailDlRow>
              <DetailDlRow label={t("detailPage.rows.period")}>
                {billingPeriodLabel(t, row.billingPeriod)}
              </DetailDlRow>
              {row.guestCount != null && (
                <DetailDlRow label={t("detailPage.rows.guests")} tabular>
                  {row.guestCount}
                </DetailDlRow>
              )}
            </DetailDl>
          </ReservationDetailSection>

          {hasGuestContact && (
            <>
              <Separator />
              <ReservationDetailSection title={t("detailPage.sections.guest")}>
                <DetailDl>
                  {row.guestPhone && (
                    <DetailDlRow label={t("detailPage.rows.phone")}>
                      {row.guestPhone}
                    </DetailDlRow>
                  )}
                  {row.guestEmail && (
                    <DetailDlRow label={t("detailPage.rows.email")}>
                      {row.guestEmail}
                    </DetailDlRow>
                  )}
                </DetailDl>
              </ReservationDetailSection>
            </>
          )}

          {row.notes && (
            <>
              <Separator />
              <ReservationDetailSection title={t("detailPage.sections.notes")}>
                <p className="text-sm whitespace-pre-wrap text-foreground">
                  {row.notes}
                </p>
              </ReservationDetailSection>
            </>
          )}

          {hasMeta && (
            <p className="text-xs text-muted-foreground">
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
        </div>
      </div>

      {showIcalWarn && row.icalSyncWarning && icalPlaybookForRow && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
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
                setCancelSession((n) => n + 1);
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
        </div>
      )}

      {(showDueWarn || showRefundWarn) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
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

      {row.utilitiesDueNotice && utilitiesMonthLabel && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t("detailPage.utilitiesDueBanner", {
              month: utilitiesMonthLabel,
            })}
          </p>
          {showUtilities && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUtilitiesSession((n) => n + 1);
                setUtilitiesOpen(true);
              }}
            >
              {t("detailPage.utilitiesDueAction")}
            </Button>
          )}
        </div>
      )}

      <PaymentMovementsTimeline reservation={row} className="mt-4 md:mt-6" />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
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
        {showCollect && (
          <Button
            type="button"
            variant={primary || showRefundWarn ? "outline" : "default"}
            onClick={() => {
              setCollectIntent("collect");
            }}
          >
            {t("reservations:format.collectLabel")}
          </Button>
        )}
        {showRefundCta && (
          <Button
            type="button"
            variant={showRefundWarn && !primary ? "default" : "outline"}
            onClick={() => {
              setCollectIntent("refund");
            }}
          >
            {t("reservations:format.refundLabel")}
          </Button>
        )}
        {showUtilities && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setUtilitiesSession((n) => n + 1);
              setUtilitiesOpen(true);
            }}
          >
            {t("detailPage.buttons.utilities")}
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-2 md:ms-auto">
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
          {cancellable && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setCancelSession((n) => n + 1);
                setCancelOpen(true);
              }}
            >
              {t("detailPage.buttons.cancel")}
            </Button>
          )}
        </div>
      </div>

      {editOpen && (
        <ReservationFormDialog
          key={`${row.id}-${editIntent}`}
          open
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
      )}

      {collectIntent && (
        <CollectSheet
          key={`${row.id}-${collectIntent}`}
          open
          onOpenChange={(open) => {
            if (!open) {
              setCollectIntent(null);
            }
          }}
          intent={collectIntent}
          reservation={row}
        />
      )}

      {utilitiesOpen && (
        <UtilitiesSheet
          key={`utilities-${utilitiesSession}`}
          open
          onOpenChange={setUtilitiesOpen}
          reservation={row}
        />
      )}

      <CancelSheet
        key={`cancel-${cancelSession}`}
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
