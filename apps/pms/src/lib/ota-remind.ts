import {
  ReservationSource,
  type ReservationSource as ReservationSourceType,
} from "@cabin/api-contract";
import {
  channelLabel,
  isOtaChannelSource,
  OTA_CHANNEL_SOURCES,
  type OtaChannelSource,
} from "@/lib/ota-channels";

export type OtaRemindReason =
  | "dates-or-unit"
  | "cancel"
  | "check-out"
  | "refresh-imports";

export type OtaSourceRemindReason = Exclude<
  OtaRemindReason,
  "refresh-imports"
>;

export type OtaRefreshTrigger =
  | "confirm"
  | "walk-in"
  | "stay-update"
  | "block-create"
  | "block-update";

export type OtaRefreshImportsContext = {
  trigger: OtaRefreshTrigger;
  unitId: string;
  bookingSource?: ReservationSourceType;
};

export type OtaRefreshImportsRemindContext = Pick<
  OtaRefreshImportsContext,
  "trigger" | "bookingSource"
>;

export type OtaRemindChecklistInput =
  | {
      reason: "refresh-imports";
      refreshContext: OtaRefreshImportsRemindContext;
    }
  | {
      reason: OtaSourceRemindReason;
      source: OtaChannelSource;
    };

/** OTA channels that should import our PMS export, excluding the booking source when set. */
export function peerOtaSources(
  bookingSource?: ReservationSourceType,
): OtaChannelSource[] {
  const exclude =
    bookingSource && isOtaChannelSource(bookingSource)
      ? bookingSource
      : undefined;
  return OTA_CHANNEL_SOURCES.filter((s) => s !== exclude);
}

export function otaPeerRefreshStep(source: OtaChannelSource): string {
  const channel = channelLabel(source);
  switch (source) {
    case ReservationSource.BOOKING_COM:
      return `${channel}: Sync calendars → Import now`;
    case ReservationSource.AIRBNB:
      return `${channel}: Calendar → Availability → Connect calendars → Refresh`;
    case ReservationSource.AGODA:
      return `${channel}: Calendar connections → Refresh connections`;
  }
}

const PEER_REFRESH_FOOTER =
  "Auto sync can take hours. Refresh when check-in is soon.";

export function otaRefreshImportsChecklist(ctx: {
  trigger: OtaRefreshTrigger;
  bookingSource?: ReservationSourceType;
}): { title: string; steps: string[] } {
  const peers = peerOtaSources(ctx.bookingSource);

  let title: string;
  switch (ctx.trigger) {
    case "block-create":
      title = "Block is on Cabin — refresh OTAs";
      break;
    case "block-update":
      title = "Block changed — refresh OTAs";
      break;
    case "stay-update":
      title = "Stay changed — refresh OTAs";
      break;
    default:
      title = "Refresh other OTAs";
  }

  const steps: string[] = [
    "Cabin updated the calendar we send out (export is live).",
  ];

  if (
    ctx.trigger === "confirm" &&
    ctx.bookingSource &&
    isOtaChannelSource(ctx.bookingSource)
  ) {
    steps.push(
      `${channelLabel(ctx.bookingSource)} already has this guest — refresh the other channels below.`,
    );
  } else if (ctx.trigger === "walk-in") {
    steps.push(
      "OTAs do not know about this stay yet until they pull our calendar.",
    );
  } else if (ctx.trigger === "stay-update") {
    steps.push(
      "OTAs still show the old dates/unit until they pull our calendar.",
    );
  } else if (
    ctx.trigger === "block-create" ||
    ctx.trigger === "block-update"
  ) {
    steps.push(
      "OTAs do not know about this closure yet until they pull our calendar.",
    );
  }

  for (const peer of peers) {
    steps.push(otaPeerRefreshStep(peer));
  }

  steps.push(PEER_REFRESH_FOOTER);

  return { title, steps };
}

export function otaUpdateChecklist(
  source: OtaChannelSource,
  reason: OtaSourceRemindReason = "dates-or-unit",
): { title: string; steps: string[] } {
  const channel = channelLabel(source);
  const peerSteps = peerOtaSources(source).map((peer) => otaPeerRefreshStep(peer));

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
          "Make dates and unit match Cabin, or the next sync will warn that the two sides disagree.",
          ...peerSteps,
          PEER_REFRESH_FOOTER,
        ],
      };
  }
}

export function otaRemindChecklist(
  input: OtaRemindChecklistInput,
): { title: string; steps: string[] } {
  if (input.reason === "refresh-imports") {
    return otaRefreshImportsChecklist(input.refreshContext);
  }
  return otaUpdateChecklist(input.source, input.reason);
}
