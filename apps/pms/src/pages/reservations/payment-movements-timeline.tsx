/* anchor: Stripe activity list, diverge: cash timeline; compact outline undo bottom-right */
import { useEffect, useMemo, useState } from "react";
import {
  canUndoPaymentMovement,
  latestPaymentMovementId,
  paymentMovementUndoRemainingMs,
  PAYMENT_MOVEMENT_PROOF_MAX,
  PaymentMovementDirection,
  type ArchiveItem,
  type PaymentMovement,
  type StaffReservation,
} from "@cabin/api-contract";
import {
  useMutation,
  useIsMutating,
  useQueryClient,
} from "@tanstack/react-query";
import { Undo2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ArchiveProofField } from "@/components/media/archive-proof-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  handleError,
  handleSuccess,
  patchPaymentMovementProofs,
  reservationCashMutationKey,
  syncReservationCaches,
  undoPaymentMovement,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { ReservationDetailSection } from "./reservation-detail-section";
import {
  formatCollectedVia,
  formatMovementCreatedAt,
  formatPaymentMovementKind,
  formatPaymentMovementSigned,
  formatUndoRemaining,
  movementsNewestFirst,
} from "./reservation-format";
import { formatIdr } from "@/pages/properties/inventory-types";

export function PaymentMovementsTimeline({
  reservation,
  className,
}: {
  reservation: StaffReservation;
  className?: string;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const queryClient = useQueryClient();
  const items = movementsNewestFirst(reservation.movements);
  const latestId = latestPaymentMovementId(items);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [undoTarget, setUndoTarget] = useState<PaymentMovement | null>(null);

  const latestRemainingMs =
    items[0] != null
      ? paymentMovementUndoRemainingMs(items[0].createdAt, new Date(nowMs))
      : 0;

  useEffect(() => {
    if (latestRemainingMs <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [latestRemainingMs]);

  const photoLabels = useMemo(
    () => ({
      add: t("reservations:timeline.photos.add"),
      limit: t("reservations:timeline.photos.limit", {
        max: PAYMENT_MOVEMENT_PROOF_MAX,
      }),
      counter: t("reservations:timeline.photos.counter"),
      noPhotos: t("reservations:timeline.photos.noPhotos"),
      titleFallback: t("reservations:timeline.photos.titleFallback"),
      previousAria: t("reservations:timeline.photos.previousAria"),
      nextAria: t("reservations:timeline.photos.nextAria"),
      closeAria: t("reservations:timeline.photos.closeAria"),
      removeAria: t("reservations:timeline.photos.removeAria"),
      nothingToPreview: t("reservations:timeline.photos.nothingToPreview"),
    }),
    [t],
  );

  const proofsMutation = useMutation({
    mutationFn: ({
      movementId,
      proofImages,
    }: {
      movementId: string;
      proofImages: ArchiveItem[];
    }) =>
      patchPaymentMovementProofs(reservation.id, movementId, { proofImages }),
    onSuccess: (saved) => {
      syncReservationCaches(queryClient, saved);
    },
  });

  const undoMutation = useMutation({
    mutationKey: reservationCashMutationKey(reservation.id),
    mutationFn: (movementId: string) =>
      undoPaymentMovement(reservation.id, movementId),
    onSuccess: (saved) => {
      const wasOut = undoTarget?.direction === PaymentMovementDirection.OUT;
      setUndoTarget(null);
      syncReservationCaches(queryClient, saved);
      handleSuccess(
        t(
          wasOut
            ? "reservations:timeline.toastUndoneRefund"
            : "reservations:timeline.toastUndone",
        ),
      );
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const cashBusy =
    useIsMutating({
      mutationKey: reservationCashMutationKey(reservation.id),
    }) > 0;

  return (
    <ReservationDetailSection
      className={className}
      title={t("reservations:timeline.title")}
      description={t("reservations:timeline.subtitle")}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("reservations:timeline.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((m) => {
            const via = formatCollectedVia(m.method);
            const isOut = m.direction === PaymentMovementDirection.OUT;
            const showUndo = canUndoPaymentMovement({
              movementId: m.id,
              createdAt: m.createdAt,
              latestId,
              reservationStatus: reservation.status,
              now: new Date(nowMs),
            });
            const remaining = showUndo
              ? paymentMovementUndoRemainingMs(m.createdAt, new Date(nowMs))
              : 0;
            const proofsBusy =
              proofsMutation.isPending &&
              proofsMutation.variables?.movementId === m.id;
            return (
              <li key={m.id} className="flex flex-col gap-2 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
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
                      {formatMovementCreatedAt(
                        m.createdAt,
                        reservation.propertyTimezone,
                      )}
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
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <ArchiveProofField
                      value={m.proofImages ?? []}
                      max={PAYMENT_MOVEMENT_PROOF_MAX}
                      layout="compact"
                      readOnly={proofsBusy}
                      labels={photoLabels}
                      onChange={async (proofImages) => {
                        await proofsMutation.mutateAsync({
                          movementId: m.id,
                          proofImages,
                        });
                      }}
                    />
                  </div>
                  {showUndo && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="shrink-0"
                      disabled={cashBusy}
                      aria-label={t(
                        isOut
                          ? "reservations:timeline.undoAriaRefund"
                          : "reservations:timeline.undoAriaCollect",
                        { time: formatUndoRemaining(remaining) },
                      )}
                      onClick={() => {
                        setUndoTarget(m);
                      }}
                    >
                      <Undo2Icon />
                      {t("reservations:timeline.undo")}
                      <span
                        aria-hidden="true"
                        className="font-normal text-muted-foreground tabular-nums"
                      >
                        {formatUndoRemaining(remaining)}
                      </span>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={undoTarget != null}
        onOpenChange={(open) => {
          if (!open && !cashBusy) {
            setUndoTarget(null);
          }
        }}
        title={t(
          undoTarget?.direction === PaymentMovementDirection.OUT
            ? "reservations:timeline.undoConfirmTitleRefund"
            : "reservations:timeline.undoConfirmTitle",
        )}
        description={
          undoTarget
            ? t(
                undoTarget.direction === PaymentMovementDirection.OUT
                  ? "reservations:timeline.undoConfirmDescriptionRefund"
                  : "reservations:timeline.undoConfirmDescription",
                { amount: formatIdr(undoTarget.amountIdr) },
              )
            : t("reservations:timeline.undoConfirmDescriptionFallback")
        }
        confirmLabel={t(
          undoTarget?.direction === PaymentMovementDirection.OUT
            ? "reservations:timeline.undoConfirmRefund"
            : "reservations:timeline.undoConfirm",
        )}
        variant="destructive"
        confirmDisabled={cashBusy || undoTarget == null}
        onConfirm={() => {
          if (!undoTarget || cashBusy) {
            return;
          }
          const stillLatest = canUndoPaymentMovement({
            movementId: undoTarget.id,
            createdAt: undoTarget.createdAt,
            latestId,
            reservationStatus: reservation.status,
            now: new Date(nowMs),
          });
          if (!stillLatest) {
            setUndoTarget(null);
            return;
          }
          undoMutation.mutate(undoTarget.id);
        }}
      />
    </ReservationDetailSection>
  );
}
