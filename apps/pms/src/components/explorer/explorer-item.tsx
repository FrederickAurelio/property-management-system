/* anchor: Linear list/grid items, diverge: open on primary / manage via ⋯ + media thumb */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ImageIcon, MoreHorizontalIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { ExplorerView } from "./types";

type ExplorerItemProps = {
  view: ExplorerView;
  title: string;
  meta: string;
  href?: string;
  badge?: ReactNode;
  /** Cover / first gallery image */
  imageUrl?: string | null;
  onEdit: () => void;
  onDelete: () => void;
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

export function ExplorerItem({
  view,
  title,
  meta,
  href,
  badge,
  imageUrl,
  onEdit,
  onDelete,
}: ExplorerItemProps) {
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={`Actions for ${title}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => {
              onEdit();
            }}
          >
            Edit
          </DropdownMenuItem>
        </DropdownMenuGroup>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (view === "grid") {
    const className = cn(
      "flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors",
      href && "hover:bg-muted/40",
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
          <div className={href ? "pointer-events-auto relative z-10" : undefined}>
            {menu}
          </div>
        </div>
      </>
    );

    if (href) {
      return (
        <div className={cn(className, "relative")}>
          <Link
            to={href}
            className="absolute inset-0 z-0 rounded-lg focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={`Open ${title}`}
          />
          <div className="relative pointer-events-none">{content}</div>
        </div>
      );
    }

    return <div className={className}>{content}</div>;
  }

  const rowClass = cn(
    "flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors",
    href && "hover:bg-muted/40",
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
      {menu}
    </>
  );

  if (href) {
    return (
      <div className={cn(rowClass, "relative")}>
        <Link
          to={href}
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
        <div className="relative z-10 pointer-events-auto">{menu}</div>
      </div>
    );
  }

  return <div className={rowClass}>{rowBody}</div>;
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
