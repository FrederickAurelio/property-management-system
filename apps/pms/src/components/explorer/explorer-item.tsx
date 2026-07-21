/* anchor: Linear list/grid items, diverge: ⋯ menu for admins, select mode for pickers */
import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router";
import { EyeIcon, ImageIcon, MoreHorizontalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ExplorerView } from "./types";

type ExplorerItemProps = {
  view: ExplorerView;
  title: string;
  meta: string;
  href?: string;
  /** Router location state for the drill-down link (breadcrumb name reuse). */
  linkState?: object;
  badge?: ReactNode;
  /** Cover / first gallery image */
  imageUrl?: string | null;
  canManage?: boolean;
  /** Inventory CRUD edit/view. Optional in picker mode. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** Picker / select mode — click card without navigating. */
  onSelect?: () => void;
  selected?: boolean;
  /** Shown but not selectable (e.g. booked / not bookable). */
  disabled?: boolean;
};

function Thumb({ url, title }: { url?: string | null; title: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="size-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="flex size-full items-center justify-center bg-muted text-muted-foreground"
      aria-hidden
    >
      <ImageIcon className="size-5" />
      <span className="sr-only">{title}</span>
    </div>
  );
}

function stopNav(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function IconAction({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: (event: MouseEvent) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground", className)}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ExplorerItem({
  view,
  title,
  meta,
  href,
  linkState,
  badge,
  imageUrl,
  canManage = true,
  onEdit,
  onDelete,
  onSelect,
  selected = false,
  disabled = false,
}: ExplorerItemProps) {
  const showActions = Boolean(onEdit);

  const actions = !showActions ? null : canManage ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={`Actions for ${title}`}
          onClick={(event) => {
            stopNav(event);
          }}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => {
              onEdit?.();
            }}
          >
            Edit
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  onDelete();
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <IconAction
      label="View"
      onClick={(event) => {
        stopNav(event);
        onEdit?.();
      }}
    >
      <EyeIcon />
    </IconAction>
  );

  const selectedClass = selected
    ? "border-ring bg-muted/50 ring-1 ring-ring"
    : undefined;
  const interactiveClass =
    !disabled && (href || onSelect)
      ? "hover:bg-muted/40 cursor-pointer"
      : undefined;
  const disabledClass = disabled
    ? "cursor-not-allowed opacity-55 bg-muted/20"
    : undefined;

  if (view === "grid") {
    const className = cn(
      "flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors",
      interactiveClass,
      selectedClass,
      disabledClass,
    );

    const content = (
      <>
        <div className="aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted">
          <Thumb url={imageUrl} title={title} />
        </div>
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium">{title}</p>
              {badge}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {meta}
            </p>
          </div>
          {actions && (
            <div
              className={href || onSelect ? "pointer-events-auto relative z-10" : undefined}
            >
              {actions}
            </div>
          )}
        </div>
      </>
    );

    if (href && !disabled) {
      return (
        <div className={cn(className, "relative")}>
          <Link
            to={href}
            state={linkState}
            className="absolute inset-0 z-0 rounded-lg focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={`Open ${title}`}
          />
          <div className="relative pointer-events-none">{content}</div>
        </div>
      );
    }

    if (onSelect && !disabled) {
      return (
        <button
          type="button"
          className={cn(className, "w-full")}
          aria-pressed={selected}
          aria-label={`Select ${title}`}
          onClick={onSelect}
        >
          {content}
        </button>
      );
    }

    return (
      <div
        className={className}
        aria-disabled={disabled || undefined}
      >
        {content}
      </div>
    );
  }

  const rowClass = cn(
    "flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors",
    interactiveClass,
    selectedClass,
    disabledClass,
  );

  const rowBody = (
    <>
      <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        <Thumb url={imageUrl} title={title} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium">{title}</p>
          {badge}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {actions}
    </>
  );

  if (href && !disabled) {
    return (
      <div className={cn(rowClass, "relative")}>
        <Link
          to={href}
          state={linkState}
          className="absolute inset-0 rounded-lg focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`Open ${title}`}
        />
        <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3 pointer-events-none">
          <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            <Thumb url={imageUrl} title={title} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium">{title}</p>
              {badge}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {meta}
            </p>
          </div>
        </div>
        {actions && (
          <div className="relative z-10 pointer-events-auto">{actions}</div>
        )}
      </div>
    );
  }

  if (onSelect && !disabled) {
    return (
      <button
        type="button"
        className={cn(rowClass, "w-full text-left")}
        aria-pressed={selected}
        aria-label={`Select ${title}`}
        onClick={onSelect}
      >
        {rowBody}
      </button>
    );
  }

  return (
    <div className={rowClass} aria-disabled={disabled || undefined}>
      {rowBody}
    </div>
  );
}

export function StatusBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "muted" | "warn";
}) {
  const variant =
    tone === "warn" ? "outline" : tone === "muted" ? "secondary" : "secondary";
  return (
    <Badge variant={variant} className="font-normal">
      {label}
    </Badge>
  );
}

export function ExplorerGrid({
  view,
  children,
}: {
  view: ExplorerView;
  children: ReactNode;
}) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    );
  }
  return <div className="flex flex-col gap-2">{children}</div>;
}

/** Mirrors `ExplorerItem` layout so loading doesn’t jump when data arrives. */
export function ExplorerItemSkeleton({ view }: { view: ExplorerView }) {
  if (view === "grid") {
    return (
      <div
        className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
        aria-hidden
      >
        <Skeleton className="aspect-4/3 w-full rounded-none border-b border-border" />
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="mt-2 h-3 w-44 max-w-full" />
          </div>
          <Skeleton className="size-7 shrink-0 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2"
      aria-hidden
    >
      <Skeleton className="size-12 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-36 max-w-full" />
        <Skeleton className="mt-1.5 h-3 w-48 max-w-full" />
      </div>
      <Skeleton className="size-7 shrink-0 rounded-md" />
    </div>
  );
}

export function ExplorerGridSkeleton({
  view,
  count = 6,
}: {
  view: ExplorerView;
  count?: number;
}) {
  return (
    <ExplorerGrid view={view}>
      {Array.from({ length: count }).map((_, i) => (
        <ExplorerItemSkeleton key={i} view={view} />
      ))}
    </ExplorerGrid>
  );
}
