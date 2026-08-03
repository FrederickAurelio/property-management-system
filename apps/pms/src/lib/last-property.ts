/** One desk-wide “current property” remembered across Dashboard / Calendar / Reservations / Reports. */
const LAST_PROPERTY_KEY = "cabin.pms.lastPropertyId";

/** Pre-unification per-page keys — read once as fallback, then promote to the shared key. */
const LEGACY_PROPERTY_KEYS = [
  "cabin.pms.dashboard.propertyId",
  "cabin.pms.calendar.propertyId",
  "cabin.pms.reservations.propertyId",
  "cabin.pms.reports.propertyId",
] as const;

export function readLastPropertyId(): string {
  try {
    const current = sessionStorage.getItem(LAST_PROPERTY_KEY);
    if (current) {
      return current;
    }
    for (const key of LEGACY_PROPERTY_KEYS) {
      const legacy = sessionStorage.getItem(key);
      if (legacy) {
        sessionStorage.setItem(LAST_PROPERTY_KEY, legacy);
        return legacy;
      }
    }
  } catch {
    /* private mode / blocked storage */
  }
  return "";
}

export function writeLastPropertyId(propertyId: string): void {
  if (!propertyId) {
    return;
  }
  try {
    sessionStorage.setItem(LAST_PROPERTY_KEY, propertyId);
  } catch {
    /* private mode / blocked storage */
  }
}
