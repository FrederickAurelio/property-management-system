/* anchor: Linear tiny proof thumb, diverge: image-only + no drag/video */
import type { ArchiveItem } from "@cabin/api-contract";
import { cn } from "@/lib/utils";

type ArchiveProofThumbProps = {
  item: ArchiveItem;
  onPreview?: () => void;
  className?: string;
  /** Extra-count label drawn over the thumb (`+2`). */
  overlay?: string;
  overlayAria?: string;
};

/** Small square meteran proof thumb sized to fit a table row (image only). */
export function ArchiveProofThumb({
  item,
  onPreview,
  className,
  overlay,
  overlayAria,
}: ArchiveProofThumbProps) {
  return (
    <button
      type="button"
      onClick={onPreview}
      title={item.name}
      aria-label={overlayAria ? `${item.name}. ${overlayAria}` : undefined}
      className={cn(
        "group/thumb relative size-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted",
        onPreview &&
          "cursor-pointer transition-opacity hover:opacity-90 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <img
        src={item.url}
        alt={item.name}
        className="size-full object-cover"
        draggable={false}
      />
      {overlay && (
        <span className="absolute inset-0 flex items-center justify-center bg-foreground/70 text-xs font-medium text-background tabular-nums">
          {overlay}
        </span>
      )}
    </button>
  );
}
