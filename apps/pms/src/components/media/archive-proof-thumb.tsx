/* anchor: Linear tiny proof thumb, diverge: image-only + no drag/video */
import type { ArchiveItem } from "@cabin/api-contract";
import { cn } from "@/lib/utils";

type ArchiveProofThumbProps = {
  item: ArchiveItem;
  onPreview?: () => void;
  className?: string;
};

/** Small square meteran proof thumb sized to fit a table row (image only). */
export function ArchiveProofThumb({
  item,
  onPreview,
  className,
}: ArchiveProofThumbProps) {
  return (
    <button
      type="button"
      onClick={onPreview}
      title={item.name}
      className={cn(
        "group/thumb relative size-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted",
        onPreview &&
          "cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      <img
        src={item.url}
        alt={item.name}
        className="size-full object-cover"
        draggable={false}
      />
    </button>
  );
}
