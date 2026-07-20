/* anchor: Linear-dense status pills, diverge: channel source colors readable in light+dark */
import type { ReservationSource } from "@cabin/api-contract";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "./reservation-format";

const toneClass: Record<BadgeTone, string> = {
  default: "border-border bg-background text-foreground",
  muted:
    "border-transparent bg-muted text-muted-foreground dark:bg-muted/80 dark:text-foreground/70",
  warn: "border-amber-600/25 bg-amber-500/10 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100",
  danger:
    "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/15 dark:text-red-300",
  ok: "border-emerald-700/25 bg-emerald-500/10 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100",
};

/** Channel colors — tinted fills + strong text (not muted-on-muted). */
const sourceClass: Record<ReservationSource, string> = {
  MANUAL:
    "border-border bg-muted text-foreground dark:bg-muted/70 dark:text-foreground",
  WEBSITE:
    "border-slate-500/30 bg-slate-500/10 text-slate-900 dark:border-slate-400/35 dark:bg-slate-400/15 dark:text-slate-100",
  BOOKING_COM:
    "border-sky-600/35 bg-sky-500/15 text-sky-950 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-100",
  AIRBNB:
    "border-rose-600/35 bg-rose-500/15 text-rose-950 dark:border-rose-400/40 dark:bg-rose-400/15 dark:text-rose-100",
  AGODA:
    "border-teal-700/35 bg-teal-500/15 text-teal-950 dark:border-teal-400/40 dark:bg-teal-400/15 dark:text-teal-100",
};

export function ReservationBadge({
  label,
  tone = "default",
  className,
}: {
  label: string;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", toneClass[tone], className)}
    >
      {label}
    </Badge>
  );
}

export function SourceBadge({
  source,
  label,
  className,
}: {
  source: ReservationSource;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", sourceClass[source], className)}
    >
      {label}
    </Badge>
  );
}
