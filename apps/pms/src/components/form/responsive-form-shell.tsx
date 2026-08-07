/* anchor: Linear-dense shell, diverge: Dialog desktop / Sheet mobile for forms */
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type ResponsiveFormShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
  /** Wider dialog for dense forms (amenities, beds, stay/block dates). */
  size?: "default" | "lg" | "xl";
};

export function ResponsiveFormShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = "default",
}: ResponsiveFormShellProps) {
  const isMobile = useIsMobile();
  /** Wide enough for the inline 2-month stay/block date panel. */
  const dialogWidth =
    size === "xl"
      ? "sm:max-w-4xl"
      : size === "lg"
        ? "sm:max-w-2xl"
        : "sm:max-w-md";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          dismissOnOutsideClick={false}
          className={cn("flex max-h-[90svh] flex-col gap-0 p-0", className)}
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {children}
          </div>
          <SheetFooter className="border-t border-border px-4 py-3">
            {footer}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dismissOnOutsideClick={false}
        className={cn(dialogWidth, className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-1 py-1">{children}</div>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
