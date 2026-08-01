/* anchor: Linear confirm modal, diverge: destructive vs default actions */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styles the confirm action (revoke, etc.). */
  variant?: "default" | "destructive";
  /** Extra classes on the confirm button (e.g. ops action colors). */
  confirmClassName?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
};

/**
 * Simple yes/no confirmation. Use for irreversible or high-impact actions.
 * Keep form/edit dialogs as plain `Dialog` (create staff, change role).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  confirmClassName,
  confirmDisabled = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation("common");
  const isDestructive = variant === "destructive";
  const resolvedConfirm = confirmLabel ?? t("actions.confirm");
  const resolvedCancel = cancelLabel ?? t("actions.cancel");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            autoFocus
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {resolvedCancel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            className={confirmClassName}
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm();
            }}
          >
            {resolvedConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
