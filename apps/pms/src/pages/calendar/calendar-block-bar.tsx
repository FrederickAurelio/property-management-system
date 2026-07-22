/* anchor: Linear-dense block bar, diverge: hatched non-guest busy */
import type { CSSProperties } from "react";
import type { StaffCalendarBlock } from "@cabin/api-contract";
import { cn } from "@/lib/utils";
import { formatBlockKind } from "./calendar-block-labels";

type CalendarBlockBarProps = {
  block: StaffCalendarBlock;
  style: CSSProperties;
  clippedStart?: boolean;
  clippedEnd?: boolean;
  onClick: () => void;
};

export function CalendarBlockBar({
  block,
  style,
  clippedStart = false,
  clippedEnd = false,
  onClick,
}: CalendarBlockBarProps) {
  const label = formatBlockKind(block.kind);
  return (
    <button
      type="button"
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute top-1 bottom-1 z-10 flex min-w-0 items-center overflow-hidden border border-dashed border-muted-foreground/40 bg-muted/70 px-1.5 text-left text-[11px] font-medium text-muted-foreground shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(0,0,0,0.06)_3px,rgba(0,0,0,0.06)_6px)] dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(255,255,255,0.06)_3px,rgba(255,255,255,0.06)_6px)]",
        !clippedStart && !clippedEnd && "rounded-md",
        clippedStart && clippedEnd && "rounded-none border-x-0",
        clippedStart && !clippedEnd && "rounded-r-md rounded-l-none border-l-0",
        clippedEnd && !clippedStart && "rounded-l-md rounded-r-none border-r-0",
      )}
      title={[label, block.note].filter(Boolean).join(" · ")}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
