/* anchor: Linear-dense detail, diverge: money always on + confirm before ops CTAs */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";
import { toast } from "sonner";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  acceptIcalDates,
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
import { PaymentMovementsTimeline } from "./payment-movements-timeline";
import { ReservationBadge, SourceBadge } from "./reservation-badges";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { ReservationMoneyBlock } from "./reservation-money-block";
import { reservationDetailBackHref } from "./reservation-nav";
import {
  confirmReadinessFromReservation,
  formatConfirmGapsMessage,
  formatIcalWarning,
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
import { IcalSyncWarning, type StaffReservation } from "@cabin/api-contract";

function primaryActionDialogCopy(
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
        title: "Confirm this reservation?",
        description:
          "Marks the stay as confirmed and ready for arrival. Guest and money details should already be complete.",
        confirmLabel: "Confirm stay",
      };
    case "check-in": {
      const early = !isCheckInWindow(row, today);
      return {
        title: early ? "Check in outside stay window?" : "Check guest in?",
        description: early
          ? `Scheduled stay is ${row.checkInDate} → ${row.checkOutDate} (property local). Check-in date stays the same unless you edit the stay.`
          : "Sets status to In-house. You can still collect a balance due afterward.",
        confirmLabel: early ? "Check in anyway" : "Check in",
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
            ? "Check out early?"
            : "Check out late?"
          : "Check guest out?",
        description: unpaid
          ? "Ends the stay. Booked dates stay as history — use Collect afterward if they still owe. OTAs pick up availability from the unit’s iCal feed (may lag)."
          : "Ends the stay. Booked dates stay as history unless you edited them first. OTAs pick up availability from the unit’s iCal feed (may lag).",
        confirmLabel: offDay
          ? row.checkOutDate > today
            ? "Check out early"
            : "Check out late"
          : "Check out",
      };
    }
  }
}

export function ReservationDetailPage() {
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

  const detailQuery = useQuery({
    queryKey: staffReservationQueryKey(reservationId),
    queryFn: () => getReservation(reservationId),
    enabled: Boolean(reservationId),
  });

  const primaryMutation = useMutation({
    mutationFn: async (action: PrimaryAction) => {
      const current = detailQuery.data;
      if (!current) {
        throw new Error("Reservation not loaded");
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
          ? "Reservation confirmed"
          : action === "check-in"
            ? "Checked in"
            : "Checked out",
      );
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const icalMutation = useMutation({
    mutationFn: async (action: "accept" | "dismiss") => {
      if (action === "accept") {
        return acceptIcalDates(reservationId);
      }
      return dismissIcalWarning(reservationId);
    },
    onSuccess: (saved, action) => {
      syncReservationCaches(queryClient, saved, {
        occupancyChanged: action === "accept",
      });
      handleSuccess(
        action === "accept"
          ? "OTA dates applied — revisit Total if needed"
          : "iCal warning dismissed",
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
            Back
          </Link>
        </Button>
        <QueryErrorPanel
          message="Couldn’t load this reservation."
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
    ? primaryActionDialogCopy(pendingPrimary, row, today)
    : null;

  const requestPrimary = (action: PrimaryAction) => {
    if (action === "confirm") {
      const gaps = confirmReadinessFromReservation(row);
      if (gaps.length > 0) {
        toast.message("Complete guest details first", {
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
            Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {row.guestName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unit {row.unitCode} · {row.propertyName}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatStayRange(row.checkInDate, row.checkOutDate, row.billingPeriod)}
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
            {lateCue ? (
              <ReservationBadge
                label={formatReservationLateCue(lateCue)}
                tone="warn"
              />
            ) : null}
          </div>
          {(row.guestPhone || row.guestEmail) && (
            <p className="mt-3 text-sm text-muted-foreground">
              {[row.guestPhone, row.guestEmail].filter(Boolean).join(" · ")}
              {row.guestCount != null && ` · ${row.guestCount} guests`}
            </p>
          )}
          {(row.createdByAdminUsername || row.updatedByAdminUsername) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {row.createdByAdminUsername
                ? `Created by ${row.createdByAdminUsername}`
                : "Created by system"}
              {row.updatedByAdminUsername
                ? ` · Last updated by ${row.updatedByAdminUsername}`
                : null}
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
          {showIcalWarn && row.icalSyncWarning && (
            <div className="flex flex-col gap-2">
              <p>
                {row.icalSyncWarning === IcalSyncWarning.OTA_STILL_LISTED
                  ? `OTA still lists this booking, but PMS is ${formatReservationStatus(row.status)}. Cancel or update it on the OTA if that was intentional, then dismiss — or dismiss after you verified the OTA.`
                  : row.icalSyncWarning === IcalSyncWarning.IMPORT_OVERLAP
                    ? "This OTA booking overlaps another stay or block on this unit. Cancel this stub, or free those nights (cancel/move the other stay) then Confirm — or edit this stay onto free dates."
                    : row.icalSyncWarning === IcalSyncWarning.DATES_DIFFER
                      ? "OTA calendar shows different dates than this stay. Accept OTA dates, edit the stay to match the OTA, or Keep & dismiss to keep local dates."
                      : row.icalSyncWarning === IcalSyncWarning.MISSING_FROM_FEED
                        ? "This booking is no longer in the OTA feed. Verify on the OTA, then Cancel if it was cancelled — or Keep & dismiss if the feed looks wrong."
                        : formatIcalWarning(row.icalSyncWarning)}
              </p>
              <div className="flex flex-wrap gap-2">
                {row.icalSyncWarning === IcalSyncWarning.DATES_DIFFER && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={icalMutation.isPending}
                    onClick={() => {
                      icalMutation.mutate("accept");
                    }}
                  >
                    Accept OTA dates
                  </Button>
                )}
                {row.icalSyncWarning === IcalSyncWarning.IMPORT_OVERLAP ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={icalMutation.isPending}
                    onClick={() => {
                      icalMutation.mutate("dismiss");
                    }}
                  >
                    Clear hold if free
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={icalMutation.isPending}
                    onClick={() => {
                      icalMutation.mutate("dismiss");
                    }}
                  >
                    {row.icalSyncWarning === IcalSyncWarning.OTA_STILL_LISTED
                      ? "Dismiss"
                      : "Keep & dismiss"}
                  </Button>
                )}
              </div>
              {row.icalSyncWarning === IcalSyncWarning.OTA_STILL_LISTED && (
                <p className="text-xs opacity-80">
                  Dismiss acknowledges this — it will not come back on the next
                  sync unless the OTA drops the booking and lists it again later.
                </p>
              )}
              {row.icalSyncWarning === IcalSyncWarning.IMPORT_OVERLAP && (
                <p className="text-xs opacity-80">
                  Clear hold only works when those nights are free. Otherwise
                  Cancel this stub or free the conflicting stay first.
                </p>
              )}
            </div>
          )}
          {showRefundWarn && (
            <p>
              Guest overpaid — use Refund to record cash returned to the guest.
            </p>
          )}
          {showDueWarn && !showRefundWarn && (
            <p>
              {isTerminalStatus(row.status)
                ? "Balance still due — use Collect to record payment."
                : "Balance due — collect anytime; check-in/out is not blocked."}
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
            Edit
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
            Cancel
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
            toast.message("Still missing details", {
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
          cancelLabel="Go back"
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
