import type { InputHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { formatChosenUnitLabel, type ChosenUnit } from "./chosen-unit";

type ChosenUnitFieldProps = {
  chosen: ChosenUnit | null;
  onChoose: () => void;
  invalid?: boolean;
  error?: { message?: string } | undefined;
  /** Hidden input name registration from RHF. */
  unitIdInputProps: InputHTMLAttributes<HTMLInputElement>;
};

/** Unit chip + Choose/Change — shared by reservation and calendar block forms. */
export function ChosenUnitField({
  chosen,
  onChoose,
  invalid = false,
  error,
  unitIdInputProps,
}: ChosenUnitFieldProps) {
  return (
    <Field data-invalid={invalid}>
      <FieldLabel>Unit</FieldLabel>
      <div className="flex items-center gap-2">
        <div
          className={
            chosen
              ? "bg-muted/40 flex min-h-8 min-w-0 flex-1 items-center rounded-lg border px-2.5 text-sm"
              : "bg-muted/40 text-muted-foreground flex min-h-8 min-w-0 flex-1 items-center rounded-lg border border-dashed px-2.5 text-sm"
          }
        >
          <span className="truncate">
            {chosen ? formatChosenUnitLabel(chosen) : "No unit chosen"}
          </span>
        </div>
        <Button
          type="button"
          variant={chosen ? "outline" : "default"}
          size="sm"
          onClick={onChoose}
        >
          {chosen ? "Change" : "Choose"}
        </Button>
      </div>
      <input type="hidden" {...unitIdInputProps} />
      <FieldError errors={[error]} />
    </Field>
  );
}
