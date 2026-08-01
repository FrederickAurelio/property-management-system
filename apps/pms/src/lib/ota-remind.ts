import {
  ReservationSource,
  type ReservationSource as ReservationSourceType,
} from "@cabin/api-contract";
import i18n from "@/i18n";
import {
  channelLabel,
  isOtaChannelSource,
  OTA_CHANNEL_SOURCES,
  type OtaChannelSource,
} from "@/lib/ota-channels";

export type OtaRemindReason =
  "dates-or-unit" | "cancel" | "check-out" | "refresh-imports";

export type OtaSourceRemindReason = Exclude<OtaRemindReason, "refresh-imports">;

export type OtaRefreshTrigger =
  "confirm" | "walk-in" | "stay-update" | "block-create" | "block-update";

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
      return i18n.t("ota:refreshImports.peerStep.bookingCom", { channel });
    case ReservationSource.AIRBNB:
      return i18n.t("ota:refreshImports.peerStep.airbnb", { channel });
    case ReservationSource.AGODA:
      return i18n.t("ota:refreshImports.peerStep.agoda", { channel });
  }
}

function peerRefreshFooter(): string {
  return i18n.t("ota:refreshImports.footer");
}

export function otaRefreshImportsChecklist(ctx: {
  trigger: OtaRefreshTrigger;
  bookingSource?: ReservationSourceType;
}): { title: string; steps: string[] } {
  const peers = peerOtaSources(ctx.bookingSource);

  let title: string;
  switch (ctx.trigger) {
    case "block-create":
      title = i18n.t("ota:refreshImports.titles.blockCreate");
      break;
    case "block-update":
      title = i18n.t("ota:refreshImports.titles.blockUpdate");
      break;
    case "stay-update":
      title = i18n.t("ota:refreshImports.titles.stayUpdate");
      break;
    default:
      title = i18n.t("ota:refreshImports.titles.default");
  }

  const steps: string[] = [i18n.t("ota:refreshImports.steps.exportLive")];

  if (
    ctx.trigger === "confirm" &&
    ctx.bookingSource &&
    isOtaChannelSource(ctx.bookingSource)
  ) {
    steps.push(
      i18n.t("ota:refreshImports.steps.confirmWithChannel", {
        channel: channelLabel(ctx.bookingSource),
      }),
    );
  } else if (ctx.trigger === "walk-in") {
    steps.push(i18n.t("ota:refreshImports.steps.walkIn"));
  } else if (ctx.trigger === "stay-update") {
    steps.push(i18n.t("ota:refreshImports.steps.stayUpdate"));
  } else if (ctx.trigger === "block-create" || ctx.trigger === "block-update") {
    steps.push(i18n.t("ota:refreshImports.steps.blockClosure"));
  }

  for (const peer of peers) {
    steps.push(otaPeerRefreshStep(peer));
  }

  steps.push(peerRefreshFooter());

  return { title, steps };
}

export function otaUpdateChecklist(
  source: OtaChannelSource,
  reason: OtaSourceRemindReason = "dates-or-unit",
): { title: string; steps: string[] } {
  const channel = channelLabel(source);
  const peerSteps = peerOtaSources(source).map((peer) =>
    otaPeerRefreshStep(peer),
  );

  switch (reason) {
    case "cancel":
      return {
        title: i18n.t("ota:updateChannel.cancel.title", { channel }),
        steps: i18n.t("ota:updateChannel.cancel.steps", {
          returnObjects: true,
          channel,
        }) as string[],
      };
    case "check-out":
      return {
        title: i18n.t("ota:updateChannel.checkOut.title", { channel }),
        steps: i18n.t("ota:updateChannel.checkOut.steps", {
          returnObjects: true,
          channel,
        }) as string[],
      };
    case "dates-or-unit":
      return {
        title: i18n.t("ota:updateChannel.datesOrUnit.title", { channel }),
        steps: [
          ...(i18n.t("ota:updateChannel.datesOrUnit.steps", {
            returnObjects: true,
            channel,
          }) as string[]),
          ...peerSteps,
          peerRefreshFooter(),
        ],
      };
  }
}

export function otaRemindChecklist(input: OtaRemindChecklistInput): {
  title: string;
  steps: string[];
} {
  if (input.reason === "refresh-imports") {
    return otaRefreshImportsChecklist(input.refreshContext);
  }
  return otaUpdateChecklist(input.source, input.reason);
}
