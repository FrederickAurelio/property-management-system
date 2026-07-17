/* anchor: Linear media lightbox, diverge: image + basic video + prev/next */
import { useEffect, useCallback } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaItem } from "./types";

type MediaPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MediaItem[];
  index: number;
  onIndexChange: (index: number) => void;
};

export function MediaPreviewDialog({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
}: MediaPreviewDialogProps) {
  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);
  const current = items[safeIndex] ?? null;
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < items.length - 1;

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
              {current?.name ?? "Preview"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {items.length > 0
                ? `${safeIndex + 1} of ${items.length}`
                : "No media"}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close preview"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            <XIcon />
          </Button>
        </div>

        <div className="relative flex min-h-[16rem] flex-1 items-center justify-center bg-muted/30">
          {hasPrev && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-2 z-10"
              aria-label="Previous"
              onClick={goPrev}
            >
              <ChevronLeftIcon />
            </Button>
          )}

          {current?.kind === "IMAGE" && (
            <img
              src={current.url}
              alt={current.name}
              className="max-h-[min(70svh,36rem)] max-w-full object-contain"
            />
          )}
          {current?.kind === "VIDEO" && (
            <video
              key={current.id}
              src={current.url}
              controls
              playsInline
              className="max-h-[min(70svh,36rem)] max-w-full"
            >
              <track kind="captions" />
            </video>
          )}
          {!current && (
            <p className="text-sm text-muted-foreground">Nothing to preview</p>
          )}

          {hasNext && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={cn("absolute right-2 z-10")}
              aria-label="Next"
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
