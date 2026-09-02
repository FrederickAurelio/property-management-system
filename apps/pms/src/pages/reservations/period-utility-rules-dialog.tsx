/* anchor: Linear-dense / Stripe-data, diverge: nested period rules on utilities sheet */
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  cloneUtilitySchemeSnapshot,
  type UtilitySchemeSnapshot,
} from "@cabin/api-contract";
import type { TFunction } from "i18next";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UtilitySchemeFields } from "@/components/utility-scheme-fields";
import {
  refineUtilitySchemeFormValues,
  utilitySchemeFormValuesFromSnapshot,
  utilitySchemeSnapshotFromFormValues,
  utilitySchemeZodFields,
  type UtilitySchemeFormValues,
} from "@/components/utility-scheme-form";

function createPeriodRulesSchema(t: TFunction) {
  return z.object(utilitySchemeZodFields(t)).superRefine((values, ctx) => {
    refineUtilitySchemeFormValues(values, ctx, t);
  });
}

export function PeriodUtilityRulesDialog({
  open,
  onOpenChange,
  remountKey,
  chargeYearMonth,
  scheme,
  unitTypeDefaults,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remountKey: string;
  chargeYearMonth: string;
  scheme: UtilitySchemeSnapshot;
  unitTypeDefaults: UtilitySchemeSnapshot;
  onSave: (scheme: UtilitySchemeSnapshot) => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <PeriodUtilityRulesForm
      key={remountKey}
      chargeYearMonth={chargeYearMonth}
      scheme={scheme}
      unitTypeDefaults={unitTypeDefaults}
      onOpenChange={onOpenChange}
      onSave={onSave}
    />
  );
}

function PeriodUtilityRulesForm({
  chargeYearMonth,
  scheme,
  unitTypeDefaults,
  onOpenChange,
  onSave,
}: {
  chargeYearMonth: string;
  scheme: UtilitySchemeSnapshot;
  unitTypeDefaults: UtilitySchemeSnapshot;
  onOpenChange: (open: boolean) => void;
  onSave: (scheme: UtilitySchemeSnapshot) => void;
}) {
  const { t } = useTranslation(["reservations", "inventory", "common"]);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const schema = useMemo(() => createPeriodRulesSchema(t), [t]);
  const form = useForm<UtilitySchemeFormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: utilitySchemeFormValuesFromSnapshot(scheme),
  });

  function close() {
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) {
            close();
          }
        }}
      >
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
          dismissOnOutsideClick={false}
        >
          <DialogHeader>
            <DialogTitle>
              {t("reservations:utilitiesSheet.periodRulesTitle", {
                month: chargeYearMonth,
              })}
            </DialogTitle>
            <DialogDescription>
              {t("reservations:utilitiesSheet.periodRulesDescription")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => {
              onSave(utilitySchemeSnapshotFromFormValues(values));
              close();
            })}
          >
            <UtilitySchemeFields
              control={form.control}
              setValue={form.setValue}
              idPrefix={`period-${chargeYearMonth}`}
            />
            <DialogFooter className="mx-0 mb-0 flex-wrap rounded-none border-t-0 bg-transparent p-0">
              <Button type="button" variant="outline" onClick={close}>
                {t("common:actions.cancel")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmCopy(true);
                }}
              >
                {t("reservations:utilitiesSheet.useUnitTypeDefaults")}
              </Button>
              <Button type="submit">
                {t("reservations:utilitiesSheet.savePeriodRules")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmCopy}
        onOpenChange={setConfirmCopy}
        title={t("reservations:utilitiesSheet.useUnitTypeDefaultsTitle")}
        description={t(
          "reservations:utilitiesSheet.useUnitTypeDefaultsDescription",
        )}
        confirmLabel={t("reservations:utilitiesSheet.useUnitTypeDefaults")}
        onConfirm={() => {
          form.reset(
            utilitySchemeFormValuesFromSnapshot(
              cloneUtilitySchemeSnapshot(unitTypeDefaults),
            ),
          );
          setConfirmCopy(false);
        }}
      />
    </>
  );
}
