import {
  ReservationSource,
  type ReservationSource as ReservationSourceType,
} from "@cabin/api-contract";

export const OTA_CHANNEL_SOURCES = [
  ReservationSource.BOOKING_COM,
  ReservationSource.AIRBNB,
  ReservationSource.AGODA,
] as const;

export type OtaChannelSource = (typeof OTA_CHANNEL_SOURCES)[number];

export function isOtaChannelSource(
  source: ReservationSourceType,
): source is OtaChannelSource {
  return (OTA_CHANNEL_SOURCES as readonly string[]).includes(source);
}

/** Human label for an OTA channel; non-OTA sources → "the OTA". */
export function channelLabel(source: ReservationSourceType): string {
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

export function isOtaLinkedStay(row: {
  externalRef?: string | null;
  source: ReservationSourceType;
}): row is { externalRef: string; source: OtaChannelSource } {
  if (!row.externalRef) {
    return false;
  }
  return isOtaChannelSource(row.source);
}
