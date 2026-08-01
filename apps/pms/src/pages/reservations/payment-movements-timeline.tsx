/* anchor: Stripe activity list, diverge: cash movement timeline */
import type { StaffReservation } from "@cabin/api-contract";
import { PaymentMovementDirection } from "@cabin/api-contract";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  formatCollectedVia,
  formatMovementCreatedAt,
  formatPaymentMovementKind,
  formatPaymentMovementSigned,
  movementsNewestFirst,
} from "./reservation-format";

export function PaymentMovementsTimeline({
  reservation,
  className,
}: {
  reservation: StaffReservation;
  className?: string;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const items = movementsNewestFirst(reservation.movements);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div>
        <h2 className="text-sm font-medium">
          {t("reservations:timeline.title")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("reservations:timeline.subtitle")}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("reservations:timeline.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((m) => {
            const via = formatCollectedVia(m.method);
            const isOut = m.direction === PaymentMovementDirection.OUT;
            return (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {formatPaymentMovementKind(m.kind)}
                    {via ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {via}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatMovementCreatedAt(m.createdAt)}
                    {m.createdByAdminUsername
                      ? ` · ${m.createdByAdminUsername}`
                      : null}
                    {m.note ? ` · ${m.note}` : null}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-medium tabular-nums",
                    isOut && "text-amber-800 dark:text-amber-200",
                  )}
                >
                  {formatPaymentMovementSigned(m)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
