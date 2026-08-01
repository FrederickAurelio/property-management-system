/* anchor: Linear media lightbox, diverge: image + basic video + prev/next */
import { useEffect, useCallback } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["inventory", "common"]);
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
              {current?.name ?? t("inventory:media.preview.titleFallback")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {items.length > 0
                ? t("inventory:media.preview.counter", {
                    index: safeIndex + 1,
                    total: items.length,
                  })
                : t("inventory:media.preview.noMedia")}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("inventory:media.preview.closeAria")}
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
              aria-label={t("inventory:media.preview.previousAria")}
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
            <p className="text-sm text-muted-foreground">
              {t("inventory:media.preview.nothingToPreview")}
            </p>
          )}

          {hasNext && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={cn("absolute right-2 z-10")}
              aria-label={t("inventory:media.preview.nextAria")}
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
