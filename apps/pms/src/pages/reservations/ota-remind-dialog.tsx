/* anchor: Linear confirm dialog, diverge: OTA checklist — must ack so desk doesn’t skip channel */
import type { ReservationSource } from "@cabin/api-contract";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  otaUpdateChecklist,
  type OtaRemindReason,
} from "./ical-playbooks";

type OtaRemindDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ReservationSource;
  reason: OtaRemindReason;
};

export function OtaRemindDialog({
  open,
  onOpenChange,
  source,
  reason,
}: OtaRemindDialogProps) {
  const checklist = otaUpdateChecklist(source, reason);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{checklist.title}</DialogTitle>
          <DialogDescription asChild>
            <ol className="mt-1 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
              {checklist.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
