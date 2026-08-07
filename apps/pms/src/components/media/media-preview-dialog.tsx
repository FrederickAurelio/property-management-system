/* anchor: Linear media lightbox, diverge: image + basic video + prev/next + optional remove */
import { useEffect, useCallback } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaKind } from "@cabin/api-contract";
import { cn } from "@/lib/utils";

/**
 * Structural item — accepts inventory `MediaItem` (with `kind`) and archive
 * `ArchiveItem` (no `kind`, treated as image) since both share these fields.
 */
export type MediaPreviewItem = {
  id: string;
  url: string;
  name: string;
  kind?: MediaKind;
};

type MediaPreviewLabels = {
  titleFallback: string;
  counter: string;
  noItems: string;
  closeAria: string;
  previousAria: string;
  nextAria: string;
  nothingToPreview: string;
  removeAria?: string;
};

type MediaPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MediaPreviewItem[];
  index: number;
  onIndexChange: (index: number) => void;
  /** When provided, renders a remove/trash action for the current item. */
  onRequestRemove?: (item: MediaPreviewItem) => void;
  /** i18n copy override (defaults to `inventory:media.preview`). */
  labels?: Partial<MediaPreviewLabels>;
};

export function MediaPreviewDialog({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
  onRequestRemove,
  labels,
}: MediaPreviewDialogProps) {
  const { t } = useTranslation(["inventory", "common"]);
  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);
  const current = items[safeIndex] ?? null;
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < items.length - 1;

  const L = (
    key: keyof MediaPreviewLabels,
    vars?: Record<string, string | number>,
  ): string => {
    if (labels?.[key] !== undefined) {
      let out = labels[key] as string;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.split(`{{${k}}}`).join(String(v));
        }
      }
      return out;
    }
    return t(`inventory:media.preview.${key}`, vars) as string;
  };

  const goPrev = useCallback(() => {
    if (hasPrev) {
      onIndexChange(safeIndex - 1);
    }
  }, [hasPrev, onIndexChange, safeIndex]);

  const goNext = useCallback(() => {
    if (hasNext) {
      onIndexChange(safeIndex + 1);
    }
  }, [hasNext, onIndexChange, safeIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, goPrev, goNext]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90svh] w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden border-border p-0 sm:max-w-3xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-medium">
              {current?.name ?? L("titleFallback")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {items.length > 0
                ? L("counter", { index: safeIndex + 1, total: items.length })
                : L("noItems")}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-1">
            {current && onRequestRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                aria-label={L("removeAria") ?? L("closeAria")}
                onClick={() => {
                  onRequestRemove(current);
                }}
              >
                <Trash2Icon />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={L("closeAria")}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              <XIcon />
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-[16rem] flex-1 items-center justify-center bg-muted/30">
          {hasPrev && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-2 z-10"
              aria-label={L("previousAria")}
              onClick={goPrev}
            >
              <ChevronLeftIcon />
            </Button>
          )}

          {current?.kind === "VIDEO" ? (
            <video
              key={current.id}
              src={current.url}
              controls
              playsInline
              className="max-h-[min(70svh,36rem)] max-w-full"
            >
              <track kind="captions" />
            </video>
          ) : current ? (
            <img
              src={current.url}
              alt={current.name}
              className="max-h-[min(70svh,36rem)] max-w-full object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {L("nothingToPreview")}
            </p>
          )}

          {hasNext && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={cn("absolute right-2 z-10")}
              aria-label={L("nextAria")}
              onClick={goNext}
            >
              <ChevronRightIcon />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
