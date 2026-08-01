import {
  IcalSyncWarning,
  type IcalSyncWarning as IcalSyncWarningType,
  type ReservationSource as ReservationSourceType,
} from "@cabin/api-contract";
import i18n from "@/i18n";
import { channelLabel } from "@/lib/ota-channels";

export type IcalPlaybookPrimaryKind =
  "accept-dates" | "accept-unit" | "cancel" | "confirm" | "clear-hold" | "none";

export type IcalPlaybook = {
  title: string;
  /** One sentence: what went wrong. */
  what: string;
  /** When staff must choose between two outcomes — bullets, plain English. */
  pickOne?: string[];
  /** Step 1 — what to check on the channel. */
  verify: string;
  /** Step 2 — what to do in Cabin (full sentence, not “use X below”). */
  cabin: string;
  primaryKind: IcalPlaybookPrimaryKind;
  primaryLabel: string | null;
  /** Extra Cabin button (e.g. Cancel on overlap). */
  secondaryKind?: "cancel";
  secondaryLabel?: string;
  otaRequired: boolean;
  otaStep: string | null;
  showDismiss: boolean;
  dismissLabel: string;
  dismissHint: string;
};

export type IcalPlaybookContext = {
  source: ReservationSourceType;
  unitCode: string;
  checkInDate: string;
  checkOutDate: string;
  statusLabel: string;
  icalObservedUnitCode?: string | null;
  icalObservedCheckInDate?: string | null;
  icalObservedCheckOutDate?: string | null;
};

/** Short list/chip title — no dates/unit details. */
export function icalWarningTitle(
  warning: IcalSyncWarningType,
  source?: ReservationSourceType | null,
): string {
  const channel = source ? channelLabel(source) : undefined;
  switch (warning) {
    case IcalSyncWarning.MISSING_FROM_FEED:
      return channel
        ? i18n.t("ota:playbooks.titles.missingFromFeedWithChannel", {
            channel,
          })
        : i18n.t("ota:playbooks.titles.missingFromFeedGeneric");
    case IcalSyncWarning.DATES_DIFFER:
      return i18n.t("ota:playbooks.titles.datesDiffer");
    case IcalSyncWarning.OTA_STILL_LISTED:
      return channel
        ? i18n.t("ota:playbooks.titles.otaStillListedWithChannel", {
            channel,
          })
        : i18n.t("ota:playbooks.titles.otaStillListedGeneric");
    case IcalSyncWarning.IMPORT_OVERLAP:
      return i18n.t("ota:playbooks.titles.importOverlap");
    case IcalSyncWarning.UNIT_DIFFER:
      return i18n.t("ota:playbooks.titles.unitDiffer");
  }
}

export function icalPlaybook(
  warning: IcalSyncWarningType,
  ctx: IcalPlaybookContext,
): IcalPlaybook {
  const channel = channelLabel(ctx.source);
  const title = icalWarningTitle(warning, ctx.source);
  const stayDates = `${ctx.checkInDate} → ${ctx.checkOutDate}`;

  switch (warning) {
    case IcalSyncWarning.MISSING_FROM_FEED:
      return {
        title,
        what: i18n.t("ota:playbooks.missingFromFeed.what", { channel }),
        pickOne: i18n.t("ota:playbooks.missingFromFeed.pickOne", {
          returnObjects: true,
          channel,
        }) as string[],
        verify: i18n.t("ota:playbooks.missingFromFeed.verify", { channel }),
        cabin: i18n.t("ota:playbooks.missingFromFeed.cabin"),
        primaryKind: "cancel",
        primaryLabel: i18n.t("ota:playbooks.missingFromFeed.primaryLabel"),
        otaRequired: false,
        otaStep: null,
        showDismiss: true,
        dismissLabel: i18n.t("ota:playbooks.missingFromFeed.dismissLabel"),
        dismissHint: i18n.t("ota:playbooks.missingFromFeed.dismissHint"),
      };
    case IcalSyncWarning.DATES_DIFFER: {
      const otaDates =
        ctx.icalObservedCheckInDate && ctx.icalObservedCheckOutDate
          ? `${ctx.icalObservedCheckInDate} → ${ctx.icalObservedCheckOutDate}`
          : i18n.t("ota:playbooks.datesDiffer.otaDatesFallback");
      return {
        title,
        what: i18n.t("ota:playbooks.datesDiffer.what", {
          channel,
          otaDates,
          stayDates,
        }),
        pickOne: i18n.t("ota:playbooks.datesDiffer.pickOne", {
          returnObjects: true,
          channel,
        }) as string[],
        verify: i18n.t("ota:playbooks.datesDiffer.verify", { channel }),
        cabin: i18n.t("ota:playbooks.datesDiffer.cabin", { channel }),
        primaryKind: "accept-dates",
        primaryLabel: i18n.t("ota:playbooks.datesDiffer.primaryLabel", {
          channel,
        }),
        otaRequired: true,
        otaStep: i18n.t("ota:playbooks.datesDiffer.otaStep", {
          channel,
          stayDates,
        }),
        showDismiss: true,
        dismissLabel: i18n.t("ota:playbooks.datesDiffer.dismissLabel"),
        dismissHint: i18n.t("ota:playbooks.datesDiffer.dismissHint"),
      };
    }
    case IcalSyncWarning.UNIT_DIFFER: {
      const observed =
        ctx.icalObservedUnitCode ??
        i18n.t("ota:playbooks.unitDiffer.observedFallback");
      const datesAlsoDiffer =
        Boolean(ctx.icalObservedCheckInDate) &&
        Boolean(ctx.icalObservedCheckOutDate) &&
        (ctx.icalObservedCheckInDate !== ctx.checkInDate ||
          ctx.icalObservedCheckOutDate !== ctx.checkOutDate);
      const what = datesAlsoDiffer
        ? i18n.t("ota:playbooks.unitDiffer.whatWithDates", {
            channel,
            observed,
            otaCheckIn: ctx.icalObservedCheckInDate,
            otaCheckOut: ctx.icalObservedCheckOutDate,
            unitCode: ctx.unitCode,
            stayDates,
          })
        : i18n.t("ota:playbooks.unitDiffer.whatUnitOnly", {
            channel,
            observed,
            unitCode: ctx.unitCode,
          });
      return {
        title,
        what,
        pickOne: i18n.t("ota:playbooks.unitDiffer.pickOne", {
          returnObjects: true,
          channel,
          observed,
          unitCode: ctx.unitCode,
        }) as string[],
        verify: i18n.t("ota:playbooks.unitDiffer.verify", { channel }),
        cabin: i18n.t("ota:playbooks.unitDiffer.cabin", { channel }),
        primaryKind: "accept-unit",
        primaryLabel: i18n.t("ota:playbooks.unitDiffer.primaryLabel", {
          channel,
        }),
        otaRequired: true,
        otaStep: i18n.t("ota:playbooks.unitDiffer.otaStep", {
          channel,
          unitCode: ctx.unitCode,
        }),
        showDismiss: true,
        dismissLabel: i18n.t("ota:playbooks.unitDiffer.dismissLabel"),
        dismissHint: i18n.t("ota:playbooks.unitDiffer.dismissHint"),
      };
    }
    case IcalSyncWarning.IMPORT_OVERLAP: {
      const primaryLabel = i18n.t("ota:playbooks.importOverlap.primaryLabel");
      return {
        title,
        what: i18n.t("ota:playbooks.importOverlap.what", {
          stayDates,
          unitCode: ctx.unitCode,
          channel,
        }),
        pickOne: i18n.t("ota:playbooks.importOverlap.pickOne", {
          returnObjects: true,
          channel,
          stayDates,
        }) as string[],
        verify: i18n.t("ota:playbooks.importOverlap.verify", {
          unitCode: ctx.unitCode,
          channel,
        }),
        cabin: i18n.t("ota:playbooks.importOverlap.cabin"),
        primaryKind: "clear-hold",
        primaryLabel,
        secondaryKind: "cancel",
        secondaryLabel: i18n.t("ota:playbooks.importOverlap.secondaryLabel"),
        otaRequired: true,
        otaStep: i18n.t("ota:playbooks.importOverlap.otaStep", { channel }),
        showDismiss: false,
        // Same copy as the primary CTA — this playbook has no separate dismiss action.
        dismissLabel: primaryLabel,
        dismissHint: i18n.t("ota:playbooks.importOverlap.dismissHint"),
      };
    }
    case IcalSyncWarning.OTA_STILL_LISTED:
      return {
        title,
        what: i18n.t("ota:playbooks.otaStillListed.what", {
          statusLabel: ctx.statusLabel,
          channel,
        }),
        pickOne: i18n.t("ota:playbooks.otaStillListed.pickOne", {
          returnObjects: true,
          channel,
        }) as string[],
        verify: i18n.t("ota:playbooks.otaStillListed.verify", { channel }),
        cabin: i18n.t("ota:playbooks.otaStillListed.cabin"),
        primaryKind: "none",
        primaryLabel: null,
        otaRequired: true,
        otaStep: i18n.t("ota:playbooks.otaStillListed.otaStep", { channel }),
        showDismiss: true,
        dismissLabel: i18n.t("ota:playbooks.otaStillListed.dismissLabel"),
        dismissHint: i18n.t("ota:playbooks.otaStillListed.dismissHint"),
      };
  }
}

export type IcalPendingAction =
  "accept-dates" | "accept-unit" | "clear-hold" | "dismiss";

export function icalActionConfirmCopy(
  action: IcalPendingAction,
  ctx: {
    source: ReservationSourceType;
    unitCode: string;
    checkInDate: string;
    checkOutDate: string;
    icalObservedUnitCode?: string | null;
    icalObservedCheckInDate?: string | null;
    icalObservedCheckOutDate?: string | null;
    dismissLabel?: string;
    /** OTA_STILL_LISTED playbooks use the "already checked" copy; others use "for now". */
    checked?: boolean;
  },
): { title: string; description: string; confirmLabel: string } {
  const channel = channelLabel(ctx.source);
  switch (action) {
    case "accept-dates": {
      const otaDates =
        ctx.icalObservedCheckInDate && ctx.icalObservedCheckOutDate
          ? `${ctx.icalObservedCheckInDate} → ${ctx.icalObservedCheckOutDate}`
          : i18n.t("ota:actionConfirm.acceptDates.otaDatesFallback");
      return {
        title: i18n.t("ota:actionConfirm.acceptDates.title", { channel }),
        description: i18n.t("ota:actionConfirm.acceptDates.description", {
          checkIn: ctx.checkInDate,
          checkOut: ctx.checkOutDate,
          otaDates,
        }),
        confirmLabel: i18n.t("ota:actionConfirm.acceptDates.confirmLabel", {
          channel,
        }),
      };
    }
    case "accept-unit": {
      const observed =
        ctx.icalObservedUnitCode ??
        i18n.t("ota:actionConfirm.acceptUnit.observedFallback");
      return {
        title: i18n.t("ota:actionConfirm.acceptUnit.title", { observed }),
        description: i18n.t("ota:actionConfirm.acceptUnit.description", {
          unitCode: ctx.unitCode,
          observed,
        }),
        confirmLabel: i18n.t("ota:actionConfirm.acceptUnit.confirmLabel", {
          observed,
        }),
      };
    }
    case "clear-hold":
      return {
        title: i18n.t("ota:actionConfirm.clearHold.title"),
        description: i18n.t("ota:actionConfirm.clearHold.description", {
          checkIn: ctx.checkInDate,
          checkOut: ctx.checkOutDate,
          unitCode: ctx.unitCode,
          channel,
        }),
        confirmLabel: i18n.t("ota:actionConfirm.clearHold.confirmLabel"),
      };
    case "dismiss":
      return {
        title: ctx.checked
          ? i18n.t("ota:actionConfirm.dismiss.titleChecked")
          : i18n.t("ota:actionConfirm.dismiss.titleForNow"),
        description: ctx.checked
          ? i18n.t("ota:actionConfirm.dismiss.descriptionChecked", {
              channel,
            })
          : i18n.t("ota:actionConfirm.dismiss.descriptionForNow", {
              channel,
            }),
        confirmLabel:
          ctx.dismissLabel ??
          i18n.t("ota:actionConfirm.dismiss.confirmLabelFallback"),
      };
  }
}
