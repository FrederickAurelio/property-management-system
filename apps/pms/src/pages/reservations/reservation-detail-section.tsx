/* anchor: Linear-dense detail / Settings section, diverge: titled Stay+Guest dl (no muted card fill) */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ReservationDetailSection({
  title,
  description,
  children,
  className,
  titleAside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  titleAside?: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-medium">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {titleAside}
      </div>
      {children}
    </section>
  );
}

export function DetailDl({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={cn("flex flex-col gap-2", className)}>{children}</dl>
  );
}

export function DetailDlRow({
  label,
  children,
  tabular,
  className,
  labelClassName,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  tabular?: boolean;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 text-sm",
        className,
      )}
    >
      <dt className={cn("shrink-0 text-muted-foreground", labelClassName)}>
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 text-right font-medium text-foreground",
          tabular && "tabular-nums",
          valueClassName,
        )}
      >
        {children}
      </dd>
    </div>
  );
}
