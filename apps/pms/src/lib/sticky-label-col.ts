import { cn } from "@/lib/utils";

/**
 * Sticky first-column label width: ~42vw on phones so the scrollable
 * side stays visible; capped at 11rem on larger viewports.
 * Prefer on an *inner* wrapper — table cells often ignore max-width alone.
 */
export const STICKY_LABEL_MAX_CLASS = "max-w-[min(42vw,11rem)]";

/** Calendar frozen unit column — same cap as sticky table labels. */
export const STICKY_LABEL_COL_CSS = "min(11rem, 42vw)";

/** Cell / head chrome for a frozen label column. */
export function stickyLabelCellClass(...extra: Array<string | undefined>) {
  return cn("sticky left-0 z-10 bg-background", ...extra);
}

/**
 * Inner wrapper — owns the viewport max-width + truncate so long labels
 * cannot inflate the sticky column past ~42vw.
 */
export function stickyLabelInnerClass(...extra: Array<string | undefined>) {
  return cn(STICKY_LABEL_MAX_CLASS, "min-w-0 truncate", ...extra);
}
