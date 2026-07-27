/* anchor: Linear-dense exception card, diverge: pick-one + ordered steps + one primary CTA */
import { Button } from "@/components/ui/button";
import type { IcalPlaybook, IcalPlaybookPrimaryKind } from "./ical-playbooks";

type IcalPlaybookCardProps = {
  playbook: IcalPlaybook;
  channelLabel: string;
  pending?: boolean;
  onPrimary: (kind: Exclude<IcalPlaybookPrimaryKind, "none">) => void;
  onDismiss: () => void;
};

export function IcalPlaybookCard({
  playbook,
  channelLabel,
  pending,
  onPrimary,
  onDismiss,
}: IcalPlaybookCardProps) {
  const primaryKind = playbook.primaryKind;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-amber-950 dark:text-amber-50">
          {playbook.title}
          <span className="font-normal text-amber-900/80 dark:text-amber-100/80">
            {" "}
            · {channelLabel}
          </span>
        </p>
        <p className="mt-1">{playbook.what}</p>
      </div>

      {playbook.pickOne && playbook.pickOne.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Pick one</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {playbook.pickOne.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <ol className="list-decimal space-y-1.5 pl-4 text-sm">
        <li>
          <span className="font-medium">Check on {channelLabel}: </span>
          {playbook.verify}
        </li>
        <li>
          <span className="font-medium">In Cabin: </span>
          {playbook.cabin}
        </li>
        {playbook.otaRequired && playbook.otaStep && (
          <li>
            <span className="font-medium">On {channelLabel}: </span>
            {playbook.otaStep}
          </li>
        )}
      </ol>

      <div className="flex flex-wrap gap-2">
        {primaryKind !== "none" && playbook.primaryLabel && (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              onPrimary(primaryKind);
            }}
          >
            {playbook.primaryLabel}
          </Button>
        )}
        {playbook.secondaryKind === "cancel" && playbook.secondaryLabel && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              onPrimary("cancel");
            }}
          >
            {playbook.secondaryLabel}
          </Button>
        )}
        {playbook.showDismiss && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={onDismiss}
          >
            {playbook.dismissLabel}
          </Button>
        )}
      </div>

      <p className="text-xs opacity-80">{playbook.dismissHint}</p>
    </div>
  );
}
