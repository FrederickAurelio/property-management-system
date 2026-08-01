/* anchor: Stripe-data money block, diverge: Due/Refund or closed cancel money */
import { ReservationStatus, type StaffReservation } from "@cabin/api-contract";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ReservationBadge } from "./reservation-badges";
import {
  formatMoneyOrDash,
  formatPaymentStatus,
  paymentBadgeTone,
  reservationDue,
  reservationRefund,
} from "./reservation-format";

export function ReservationMoneyBlock({
  reservation,
  className,
}: {
  reservation: StaffReservation;
  className?: string;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const due = reservationDue(reservation);
  const refund = reservationRefund(reservation);
  const showRefund = refund != null && refund > 0;
  const moneyClosed = reservation.status === ReservationStatus.CANCELLED;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/30 px-4 py-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {t("reservations:moneyBlock.title")}
        </p>
        <ReservationBadge
          label={formatPaymentStatus(reservation.paymentStatus)}
          tone={paymentBadgeTone(reservation.paymentStatus)}
        />
      </div>
      <dl className="mt-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="shrink-0 text-sm text-muted-foreground">
            {t("reservations:moneyBlock.total")}
          </dt>
          <dd className="min-w-0 text-right text-base font-medium tracking-tight tabular-nums">
            {formatMoneyOrDash(reservation.totalAmountIdr)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="shrink-0 text-sm text-muted-foreground">
            {moneyClosed
              ? t("reservations:moneyBlock.collected")
              : t("reservations:moneyBlock.paid")}
          </dt>
          <dd className="min-w-0 text-right text-base font-medium tracking-tight tabular-nums">
            {formatMoneyOrDash(reservation.paidAmountIdr)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
          {moneyClosed ? (
            <>
              <dt className="shrink-0 text-sm font-medium text-foreground">
                {t("reservations:moneyBlock.propertyKept")}
              </dt>
              <dd className="min-w-0 text-right text-lg font-semibold tracking-tight tabular-nums">
                {formatMoneyOrDash(reservation.paidAmountIdr)}
              </dd>
            </>
          ) : (
            <>
              <dt className="shrink-0 text-sm font-medium text-foreground">
                {showRefund
                  ? t("reservations:moneyBlock.refund")
                  : t("reservations:moneyBlock.due")}
              </dt>
              <dd
                className={cn(
                  "min-w-0 text-right text-lg font-semibold tracking-tight tabular-nums",
                  showRefund && "text-amber-800 dark:text-amber-200",
                )}
              >
                {formatMoneyOrDash(showRefund ? refund : due)}
              </dd>
            </>
          )}
        </div>
      </dl>
      {moneyClosed && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("reservations:moneyBlock.settledOnCancelHint")}
        </p>
      )}
      {!moneyClosed && showRefund && (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
          {t("reservations:moneyBlock.overpaidHint")}
        </p>
      )}
    </div>
  );
}
