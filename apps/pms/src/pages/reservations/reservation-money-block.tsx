/* anchor: Linear-dense detail section, diverge: money as titled dl matching Stay/Guest */
import { ReservationStatus, type StaffReservation } from "@cabin/api-contract";
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
        <DetailDlRow label={t("reservations:moneyBlock.total")} tabular>
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
