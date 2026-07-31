/* anchor: Linear confirm dialog, diverge: OTA checklist — must ack so desk doesn’t skip channel */
import type { OtaChannelSource } from "@/lib/ota-channels";
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
  otaRemindChecklist,
  type OtaRefreshImportsRemindContext,
  type OtaSourceRemindReason,
} from "@/lib/ota-remind";

type OtaRemindDialogBaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type OtaRemindDialogProps = OtaRemindDialogBaseProps &
  (
    | {
        reason: "refresh-imports";
        refreshContext: OtaRefreshImportsRemindContext;
        source?: never;
      }
    | {
        reason: OtaSourceRemindReason;
        source: OtaChannelSource;
        refreshContext?: never;
      }
  );

export function OtaRemindDialog(props: OtaRemindDialogProps) {
  const { open, onOpenChange, reason } = props;
  const checklist =
    reason === "refresh-imports"
      ? otaRemindChecklist({
          reason,
          refreshContext: props.refreshContext,
        })
      : otaRemindChecklist({ reason, source: props.source });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{checklist.title}</DialogTitle>
          <DialogDescription asChild>
            <ol className="mt-1 flex list-decimal flex-col gap-2 pl-4 text-sm text-muted-foreground">
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
