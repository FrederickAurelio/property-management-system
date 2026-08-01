import type { InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["reservations", "common"]);
  return (
    <Field data-invalid={invalid}>
      <FieldLabel>{t("reservations:chosenUnitField.label")}</FieldLabel>
      <div className="flex items-center gap-2">
        <div
          className={
            chosen
              ? "flex min-h-8 min-w-0 flex-1 items-center rounded-lg border bg-muted/40 px-2.5 text-sm"
              : "flex min-h-8 min-w-0 flex-1 items-center rounded-lg border border-dashed bg-muted/40 px-2.5 text-sm text-muted-foreground"
          }
        >
          <span className="truncate">
            {chosen
              ? formatChosenUnitLabel(chosen)
              : t("reservations:chosenUnitField.noneChosen")}
          </span>
        </div>
        <Button
          type="button"
          variant={chosen ? "outline" : "default"}
          size="sm"
          onClick={onChoose}
        >
          {chosen
            ? t("reservations:chosenUnitField.change")
            : t("reservations:chosenUnitField.choose")}
        </Button>
      </div>
      <input type="hidden" {...unitIdInputProps} />
      <FieldError errors={[error]} />
    </Field>
  );
}
