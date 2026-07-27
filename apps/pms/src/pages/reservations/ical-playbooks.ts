import {
  IcalSyncWarning,
  ReservationSource,
  type IcalSyncWarning as IcalSyncWarningType,
  type ReservationSource as ReservationSourceType,
} from "@cabin/api-contract";

export type IcalPlaybookPrimaryKind =
  | "accept-dates"
  | "accept-unit"
  | "cancel"
  | "confirm"
  | "clear-hold"
  | "none";

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

function channelLabel(source: ReservationSourceType): string {
  switch (source) {
    case ReservationSource.BOOKING_COM:
      return "Booking.com";
    case ReservationSource.AIRBNB:
      return "Airbnb";
    case ReservationSource.AGODA:
      return "Agoda";
    default:
      return "the OTA";
  }
}

/** Short list/chip title — no dates/unit details. */
export function icalWarningTitle(
  warning: IcalSyncWarningType,
  source?: ReservationSourceType | null,
): string {
  const channel = source ? channelLabel(source) : "OTA";
  switch (warning) {
    case IcalSyncWarning.MISSING_FROM_FEED:
      return source ? `Gone from ${channel}` : "Gone from OTA";
    case IcalSyncWarning.DATES_DIFFER:
      return "Dates don’t match";
    case IcalSyncWarning.OTA_STILL_LISTED:
      return source ? `Still on ${channel}` : "Still on OTA";
    case IcalSyncWarning.IMPORT_OVERLAP:
      return "Double-booked nights";
    case IcalSyncWarning.UNIT_DIFFER:
      return "Wrong unit";
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
        what: `${channel} no longer shows this booking in its calendar.`,
        pickOne: [
          `Guest cancelled on ${channel} → cancel this stay in Cabin too.`,
          `Feed looks wrong / temporary → dismiss for now and check again after the next sync.`,
        ],
        verify: `Look up this guest on ${channel}. Is the booking still there?`,
        cabin:
          "If it’s gone for real, cancel this stay. That frees the unit and closes money if needed.",
        primaryKind: "cancel",
        primaryLabel: "Cancel this stay",
        otaRequired: false,
        otaStep: null,
        showDismiss: true,
        dismissLabel: "Dismiss for now",
        dismissHint:
          "Only hides the alert until the next sync. It will come back if the booking is still missing.",
      };
    case IcalSyncWarning.DATES_DIFFER: {
      const otaDates =
        ctx.icalObservedCheckInDate && ctx.icalObservedCheckOutDate
          ? `${ctx.icalObservedCheckInDate} → ${ctx.icalObservedCheckOutDate}`
          : "different dates";
      return {
        title,
        what: `${channel} has ${otaDates}. Cabin still has ${stayDates}.`,
        pickOne: [
          `${channel} is correct → use their dates in Cabin (revisit Total after).`,
          `Cabin is correct → change the booking dates on ${channel} to match.`,
        ],
        verify: `Open the guest reservation on ${channel} and compare the stay dates.`,
        cabin: `To match ${channel}, tap Use ${channel} dates. Or edit this stay in Cabin, then update ${channel}.`,
        primaryKind: "accept-dates",
        primaryLabel: `Use ${channel} dates`,
        otaRequired: true,
        otaStep: `If Cabin should win, edit the reservation on ${channel} so dates match ${stayDates}.`,
        showDismiss: true,
        dismissLabel: "Dismiss for now",
        dismissHint:
          "Keeps Cabin’s dates. The alert returns on the next sync until both sides match.",
      };
    }
    case IcalSyncWarning.UNIT_DIFFER: {
      const observed = ctx.icalObservedUnitCode ?? "another unit";
      const datesAlsoDiffer =
        Boolean(ctx.icalObservedCheckInDate) &&
        Boolean(ctx.icalObservedCheckOutDate) &&
        (ctx.icalObservedCheckInDate !== ctx.checkInDate ||
          ctx.icalObservedCheckOutDate !== ctx.checkOutDate);
      const what = datesAlsoDiffer
        ? `${channel} has this on unit ${observed} (${ctx.icalObservedCheckInDate} → ${ctx.icalObservedCheckOutDate}). Cabin has unit ${ctx.unitCode} (${stayDates}).`
        : `${channel} has this on unit ${observed}. Cabin still has unit ${ctx.unitCode}.`;
      return {
        title,
        what,
        pickOne: [
          `${channel} is correct → move this stay to unit ${observed} in Cabin.`,
          `Cabin is correct → move the booking back to unit ${ctx.unitCode} on ${channel}.`,
        ],
        verify: `On ${channel}, which unit did the guest actually book?`,
        cabin: `To match ${channel}, tap Move to ${channel}’s unit (fails if that unit is already busy).`,
        primaryKind: "accept-unit",
        primaryLabel: `Move to ${channel}’s unit`,
        otaRequired: true,
        otaStep: `If Cabin should win, change the listing/unit on ${channel} back to ${ctx.unitCode}.`,
        showDismiss: true,
        dismissLabel: "Dismiss for now",
        dismissHint:
          "Leaves the stay on this unit. The alert returns on the next sync until both sides match.",
      };
    }
    case IcalSyncWarning.IMPORT_OVERLAP:
      return {
        title,
        what: `These nights (${stayDates}) on unit ${ctx.unitCode} are already taken by another stay or block. This ${channel} booking is waiting — it does not block the calendar yet.`,
        pickOne: [
          `Keep the other stay → cancel this ${channel} booking in Cabin (and on ${channel} if it isn’t a real guest).`,
          `Keep this ${channel} guest → free ${stayDates} on the other stay first (cancel or move it), then tap below.`,
        ],
        verify: `Check the calendar for unit ${ctx.unitCode} and the booking on ${channel}. Who should keep these nights?`,
        cabin:
          "After the other stay is gone or moved, tap Nights are free now. Then fill guest details and Confirm. Or cancel this booking if the other stay wins.",
        primaryKind: "clear-hold",
        primaryLabel: "Nights are free now",
        secondaryKind: "cancel",
        secondaryLabel: "Cancel this booking",
        otaRequired: true,
        otaStep: `If you cancel here because ${channel} double-sold, fix or cancel the booking on ${channel} too.`,
        showDismiss: false,
        dismissLabel: "Nights are free now",
        dismissHint:
          "“Nights are free now” only works after the conflict is gone. If nights are still busy, cancel this booking or free the other stay first.",
      };
    case IcalSyncWarning.OTA_STILL_LISTED:
      return {
        title,
        what: `Cabin already marked this stay as ${ctx.statusLabel}, but ${channel} still shows it as booked.`,
        pickOne: [
          `Intentional (early checkout, local cancel) → cancel or update the booking on ${channel}, then dismiss.`,
          `Already fixed on ${channel} → dismiss.`,
        ],
        verify: `Open ${channel} and check whether this booking is still active.`,
        cabin:
          "Cabin is already closed for this stay. Nothing to change here except dismiss after you verify.",
        primaryKind: "none",
        primaryLabel: null,
        otaRequired: true,
        otaStep: `If ${channel} should not list this guest anymore, cancel or change that booking there.`,
        showDismiss: true,
        dismissLabel: "Dismiss — I checked",
        dismissHint:
          "Won’t warn again while this booking stays on the feed. If it disappears and comes back later, the alert can return.",
      };
  }
}

export type OtaRemindReason = "dates-or-unit" | "cancel" | "check-out";

/** Pending playbook mutation that needs a confirm dialog (not Cancel sheet). */
export type IcalPendingAction =
  | "accept-dates"
  | "accept-unit"
  | "clear-hold"
  | "dismiss";

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
  },
): { title: string; description: string; confirmLabel: string } {
  const channel = channelLabel(ctx.source);
  switch (action) {
    case "accept-dates": {
      const otaDates =
        ctx.icalObservedCheckInDate && ctx.icalObservedCheckOutDate
          ? `${ctx.icalObservedCheckInDate} → ${ctx.icalObservedCheckOutDate}`
          : "the dates from the OTA";
      return {
        title: `Use ${channel} dates?`,
        description: `Cabin will change this stay from ${ctx.checkInDate} → ${ctx.checkOutDate} to ${otaDates}. Revisit Total if the length of stay changed.`,
        confirmLabel: `Use ${channel} dates`,
      };
    }
    case "accept-unit": {
      const observed = ctx.icalObservedUnitCode ?? "the OTA unit";
      return {
        title: `Move to ${observed}?`,
        description: `This stay will move from unit ${ctx.unitCode} to ${observed}. It fails if ${observed} already has overlapping nights.`,
        confirmLabel: `Move to ${observed}`,
      };
    }
    case "clear-hold":
      return {
        title: "Mark nights free?",
        description: `Only continue if ${ctx.checkInDate} → ${ctx.checkOutDate} on unit ${ctx.unitCode} are actually free. This clears the double-book alert so you can Confirm the ${channel} booking.`,
        confirmLabel: "Nights are free now",
      };
    case "dismiss":
      return {
        title: ctx.dismissLabel?.includes("checked")
          ? "Dismiss this alert?"
          : "Dismiss for now?",
        description: ctx.dismissLabel?.includes("checked")
          ? `Hides this alert. It will not come back on the next sync unless ${channel} drops the booking and lists it again later.`
          : `Hides this alert until the next sync. If nothing changed on ${channel}, it will likely come back.`,
        confirmLabel: ctx.dismissLabel ?? "Dismiss",
      };
  }
}

export function isOtaLinkedStay(row: {
  externalRef?: string | null;
  source: ReservationSourceType;
}): boolean {
  if (!row.externalRef) {
    return false;
  }
  return (
    row.source === ReservationSource.BOOKING_COM ||
    row.source === ReservationSource.AIRBNB ||
    row.source === ReservationSource.AGODA
  );
}

export function otaUpdateChecklist(
  source: ReservationSourceType,
  reason: OtaRemindReason = "dates-or-unit",
): {
  title: string;
  steps: string[];
} {
  const channel = channelLabel(source);

  switch (reason) {
    case "cancel":
      return {
        title: `Cancel on ${channel} too`,
        steps: [
          "Cabin cancelled this stay and freed the unit on our calendar.",
          `${channel} does not cancel the guest booking by itself — open ${channel} and cancel (or modify) that reservation.`,
          `If you leave it active on ${channel}, the next sync may warn that it is still listed.`,
        ],
      };
    case "check-out":
      return {
        title: `Update ${channel} if needed`,
        steps: [
          "Cabin checked the guest out and updated the busy calendar we send out.",
          `If they left early, or the booking on ${channel} should end, edit or cancel that reservation on ${channel}.`,
          `${channel} will not change the guest booking automatically.`,
        ],
      };
    case "dates-or-unit":
      return {
        title: `Update ${channel} too`,
        steps: [
          "Cabin already saved the new dates/unit and updated the busy calendar we send out.",
          `${channel} does not update the guest’s booking by itself — you must edit that reservation on ${channel}.`,
          `Make dates and unit match Cabin, or the next sync will warn that the two sides disagree.`,
        ],
      };
  }
}
