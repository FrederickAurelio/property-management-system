/* anchor: Linear media thumb, diverge: hover eye desktop / long-press mobile */
import { useRef, useState, type ReactNode } from "react";
import { EyeIcon, FilmIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { MediaItem } from "./types";

const LONG_PRESS_MS = 450;

type MediaThumbProps = {
  item: MediaItem;
  className?: string;
  /** Opens preview when eye / long-press fires */
  onPreview?: () => void;
  /** Extra overlay (drag handle, delete) — desktop pointer-events managed by parent */
  overlay?: ReactNode;
  /** Hide interactive preview affordances */
  previewDisabled?: boolean;
};

export function MediaThumb({
  item,
  className,
  onPreview,
  overlay,
  previewDisabled = false,
}: MediaThumbProps) {
  const { t } = useTranslation(["inventory", "common"]);
  const isMobile = useIsMobile();
  const timerRef = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPressed(false);
  }

  function startLongPress() {
    if (previewDisabled || !onPreview || !isMobile) {
      return;
    }
    setPressed(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPressed(false);
      onPreview();
    }, LONG_PRESS_MS);
  }

  return (
    <div
      className={cn(
        "group/thumb relative aspect-square overflow-hidden rounded-md border border-border bg-muted",
        pressed && "ring-1 ring-ring",
        className,
      )}
      onTouchStart={startLongPress}
      onTouchEnd={clearTimer}
      onTouchMove={clearTimer}
      onTouchCancel={clearTimer}
      onContextMenu={(event) => {
        if (isMobile && onPreview && !previewDisabled) {
          event.preventDefault();
        }
      }}
    >
      {item.kind === "IMAGE" ? (
        <img
          src={item.url}
          alt={item.name}
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="relative size-full bg-foreground/5">
          <video
            src={item.url}
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/20">
            <FilmIcon className="size-5 text-background" />
          </div>
        </div>
      )}

      {!previewDisabled && onPreview && !isMobile && (
        <button
          type="button"
          aria-label={t("inventory:media.previewAria", { name: item.name })}
          className="absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition-opacity group-hover/thumb:bg-foreground/35 group-hover/thumb:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPreview();
          }}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm">
            <EyeIcon className="size-4" />
          </span>
        </button>
      )}

      {overlay && (
        <div className="absolute top-1 right-1 z-10 flex gap-1">{overlay}</div>
      )}
    </div>
  );
}
