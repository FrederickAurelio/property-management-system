/* anchor: Linear-dense detail section, diverge: money as titled dl matching Stay/Guest */
import {
  ReservationStatus,
  StayBillingPeriod,
  type StaffReservation,
} from "@cabin/api-contract";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ReservationBadge } from "./reservation-badges";
import {
  DetailDl,
  DetailDlRow,
  ReservationDetailSection,
} from "./reservation-detail-section";
import {
  formatMoneyOrDash,
  formatPaymentStatus,
  paymentBadgeTone,
  reservationDue,
  reservationRefund,
} from "./reservation-format";

function showQuoteBreakdown(reservation: StaffReservation): boolean {
  if (
    reservation.billingPeriod === StayBillingPeriod.MONTHLY ||
    reservation.billingPeriod === StayBillingPeriod.YEARLY
  ) {
    return true;
  }
  return (
    reservation.electricityAmountIdr > 0 ||
    reservation.waterAmountIdr > 0 ||
    reservation.maintenanceAmountIdr > 0 ||
    reservation.adminAmountIdr > 0
  );
}

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
  const breakdown = showQuoteBreakdown(reservation);

  return (
    <ReservationDetailSection
      className={className}
      title={t("reservations:moneyBlock.title")}
      titleAside={
        <ReservationBadge
          label={formatPaymentStatus(reservation.paymentStatus)}
          tone={paymentBadgeTone(reservation.paymentStatus)}
        />
      }
    >
      <DetailDl>
        {breakdown && (
          <>
            <DetailDlRow label={t("reservations:moneyBlock.rent")} tabular>
              {formatMoneyOrDash(
                reservation.rentAmountIdr ?? reservation.totalAmountIdr,
              )}
            </DetailDlRow>
            <DetailDlRow
              label={t("reservations:moneyBlock.electricity")}
              tabular
            >
              {formatMoneyOrDash(reservation.electricityAmountIdr)}
            </DetailDlRow>
            <DetailDlRow label={t("reservations:moneyBlock.water")} tabular>
              {formatMoneyOrDash(reservation.waterAmountIdr)}
            </DetailDlRow>
            <DetailDlRow
              label={t("reservations:moneyBlock.maintenance")}
              tabular
            >
              {formatMoneyOrDash(reservation.maintenanceAmountIdr)}
            </DetailDlRow>
            <DetailDlRow label={t("reservations:moneyBlock.admin")} tabular>
              {formatMoneyOrDash(reservation.adminAmountIdr)}
            </DetailDlRow>
          </>
        )}
        <DetailDlRow
          className={breakdown ? "border-t border-border pt-2" : undefined}
          label={t("reservations:moneyBlock.total")}
          labelClassName={breakdown ? "font-medium text-foreground" : undefined}
          tabular
        >
          {formatMoneyOrDash(reservation.totalAmountIdr)}
        </DetailDlRow>
        <DetailDlRow
          label={
            moneyClosed
              ? t("reservations:moneyBlock.collected")
              : t("reservations:moneyBlock.paid")
          }
          tabular
        >
          {formatMoneyOrDash(reservation.paidAmountIdr)}
        </DetailDlRow>
        <DetailDlRow
          className="border-t border-border pt-2"
          label={
            moneyClosed
              ? t("reservations:moneyBlock.propertyKept")
              : showRefund
                ? t("reservations:moneyBlock.refund")
                : t("reservations:moneyBlock.due")
          }
          labelClassName="font-medium text-foreground"
          valueClassName={cn(
            "font-semibold tracking-tight",
            showRefund && !moneyClosed && "text-amber-800 dark:text-amber-200",
          )}
          tabular
        >
          {formatMoneyOrDash(
            moneyClosed
              ? reservation.paidAmountIdr
              : showRefund
                ? refund
                : due,
          )}
        </DetailDlRow>
      </DetailDl>
      {moneyClosed && (
        <p className="text-xs text-muted-foreground">
          {t("reservations:moneyBlock.settledOnCancelHint")}
        </p>
      )}
      {!moneyClosed && showRefund && (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {t("reservations:moneyBlock.overpaidHint")}
        </p>
      )}
    </ReservationDetailSection>
  );
}
