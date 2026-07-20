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
  checkInReservation,
  checkOutReservation,
  confirmReservation,
  getReservation,
  handleError,
  handleSuccess,
  invalidateReservationCaches,
  staffReservationQueryKey,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { CancelSheet } from "./cancel-sheet";
import { CollectSheet } from "./collect-sheet";
import { PaymentMovementsTimeline } from "./payment-movements-timeline";
import { ReservationBadge, SourceBadge } from "./reservation-badges";
import { ReservationFormDialog } from "./reservation-form-dialog";
import { ReservationMoneyBlock } from "./reservation-money-block";
import { reservationsListHref } from "./reservation-nav";
import {
  confirmReadinessFromReservation,
  formatConfirmGapsMessage,
  formatIcalWarning,
  formatReservationSource,
  formatReservationStatus,
  formatStayRange,
  canCollectPayment,
  canEditStay,
  isTerminalStatus,
  primaryActionButtonClass,
  primaryActionFor,
  primaryActionLabel,
  reservationDue,
  reservationRefund,
  collectPaymentLabel,
  statusBadgeTone,
  todayYmd,
  type PrimaryAction,
} from "./reservation-format";
import type { StaffReservation } from "@cabin/api-contract";

function primaryActionDialogCopy(
  action: PrimaryAction,
  row: StaffReservation,
  today: string = todayYmd(),
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
      const early = row.checkInDate > today;
      return {
        title: early ? "Check in early?" : "Check guest in?",
        description: early
          ? `Scheduled arrival is ${row.checkInDate}. Check-in date stays the same unless you edit the stay.`
          : "Sets status to In-house. You can still collect a balance due afterward.",
        confirmLabel: early ? "Check in early" : "Check in",
      };
    }
    case "check-out": {
      const due =
        row.totalAmountIdr == null
          ? null
          : Math.max(row.totalAmountIdr - row.paidAmountIdr, 0);
      const unpaid = due != null && due > 0;
      return {
        title: "Check guest out?",
        description: unpaid
          ? "Ends the stay. Booked dates stay as history — use Collect afterward if they still owe. OTAs pick up availability from the unit’s iCal feed (may lag)."
          : "Ends the stay. Booked dates stay as history unless you edited them first. OTAs pick up availability from the unit’s iCal feed (may lag).",
        confirmLabel: "Check out",
      };
    }
  }
}

export function ReservationDetailPage() {
  const { reservationId = "" } = useParams();
  const location = useLocation();
  const backHref = reservationsListHref(location.state);
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

  const invalidate = (id: string) => {
    invalidateReservationCaches(queryClient, id);
  };

  const primaryMutation = useMutation({
    mutationFn: async (action: PrimaryAction) => {
      switch (action) {
        case "confirm":
          return confirmReservation(reservationId);
        case "check-in":
          return checkInReservation(reservationId);
        case "check-out":
          return checkOutReservation(reservationId);
      }
    },
    onSuccess: (saved, action) => {
      invalidate(saved.id);
      setPendingPrimary(null);
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
        <Button type="button" variant="ghost" size="sm" asChild className="w-fit">
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
  const primary = primaryActionFor(row);
  const due = reservationDue(row);
  const refund = reservationRefund(row);
  const editable = canEditStay(row.status);
  const showCollect = canCollectPayment(row);
  const showDueWarn = due != null && due > 0 && showCollect;
  const showRefundWarn = refund != null && refund > 0 && showCollect;
  const showIcalWarn = row.icalSyncWarning != null;
  const pendingCopy = pendingPrimary
    ? primaryActionDialogCopy(pendingPrimary, row)
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
            {formatStayRange(row.checkInDate, row.checkOutDate)}
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
          </div>
          {(row.guestPhone || row.guestEmail) && (
            <p className="mt-3 text-sm text-muted-foreground">
              {[row.guestPhone, row.guestEmail].filter(Boolean).join(" · ")}
              {row.guestCount != null && ` · ${row.guestCount} guests`}
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
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {showIcalWarn && row.icalSyncWarning && (
            <p>{formatIcalWarning(row.icalSyncWarning)}</p>
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
