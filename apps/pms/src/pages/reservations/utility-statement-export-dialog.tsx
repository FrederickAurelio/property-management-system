/* anchor: Linear-dense, diverge: Cara Pembayaran fields + click-to-fill recents */
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  UTILITY_STATEMENT_ACCOUNT_NAME_MAX,
  UTILITY_STATEMENT_ACCOUNT_NUMBER_MAX,
  UTILITY_STATEMENT_BANK_NAME_MAX,
  type StaffUtilityStatementBankAccount,
  type UtilityStatementPayee,
} from "@cabin/api-contract";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { QueryRetryButton } from "@/components/query-retry-button";
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listUtilityStatementBankAccounts,
  staffUtilityStatementBankAccountsQueryKey,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type PayeeFormValues = UtilityStatementPayee;

function emptyPayee(): PayeeFormValues {
  return {
    bankName: "",
    accountName: "",
    accountNumber: "",
  };
}

function payeeFromRecent(
  row: StaffUtilityStatementBankAccount,
): PayeeFormValues {
  return {
    bankName: row.bankName,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
  };
}

export function UtilityStatementExportDialog({
  open,
  exportPending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  exportPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payee: UtilityStatementPayee) => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <UtilityStatementExportForm
      exportPending={exportPending}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}

function UtilityStatementExportForm({
  exportPending,
  onOpenChange,
  onConfirm,
}: {
  exportPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payee: UtilityStatementPayee) => void;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const recentsQuery = useQuery({
    queryKey: staffUtilityStatementBankAccountsQueryKey,
    queryFn: listUtilityStatementBankAccounts,
  });

  function close() {
    onOpenChange(false);
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        dismissOnOutsideClick={false}
      >
        <DialogHeader>
          <DialogTitle>
            {t("reservations:utilitiesSheet.exportConfirmTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("reservations:utilitiesSheet.exportConfirmDescription")}
          </DialogDescription>
        </DialogHeader>
        {recentsQuery.isPending && <ExportPayeeSkeleton />}
        {recentsQuery.isError && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-destructive">
              {t("reservations:utilitiesSheet.exportRecentsError")}
            </p>
            <QueryRetryButton
              onRetry={() => {
                void recentsQuery.refetch();
              }}
              isRetrying={recentsQuery.isFetching}
            />
          </div>
        )}
        {recentsQuery.data && (
          <ExportPayeeFields
            recents={recentsQuery.data}
            exportPending={exportPending}
            onCancel={close}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExportPayeeSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function ExportPayeeFields({
  recents,
  exportPending,
  onCancel,
  onConfirm,
}: {
  recents: StaffUtilityStatementBankAccount[];
  exportPending: boolean;
  onCancel: () => void;
  onConfirm: (payee: UtilityStatementPayee) => void;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const schema = useMemo(
    () =>
      z.object({
        bankName: z
          .string()
          .trim()
          .min(1, t("reservations:utilitiesSheet.exportBankNameRequired"))
          .max(UTILITY_STATEMENT_BANK_NAME_MAX),
        accountName: z
          .string()
          .trim()
          .min(1, t("reservations:utilitiesSheet.exportAccountNameRequired"))
          .max(UTILITY_STATEMENT_ACCOUNT_NAME_MAX),
        accountNumber: z
          .string()
          .trim()
          .min(1, t("reservations:utilitiesSheet.exportAccountNumberRequired"))
          .max(UTILITY_STATEMENT_ACCOUNT_NUMBER_MAX),
      }),
    [t],
  );
  const latest = recents[0];
  const form = useForm<PayeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: latest ? payeeFromRecent(latest) : emptyPayee(),
  });
  const [selectedId, setSelectedId] = useState(latest?.id ?? null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((payee) => {
        onConfirm(payee);
      })}
    >
      {recents.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">
            {t("reservations:utilitiesSheet.exportRecents")}
          </p>
          <ul className="flex max-h-36 flex-col gap-1 overflow-y-auto">
            {recents.map((row) => {
              const active = selectedId === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-11 w-full min-w-0 flex-col items-start rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                      active
                        ? "border-border bg-muted"
                        : "border-transparent hover:bg-muted/60",
                    )}
                    onClick={() => {
                      setSelectedId(row.id);
                      form.reset(payeeFromRecent(row));
                    }}
                  >
                    <span className="w-full truncate font-medium">
                      {row.bankName}
                    </span>
                    <span className="w-full truncate text-muted-foreground">
                      {row.accountName} · {row.accountNumber}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <FieldGroup>
        <Controller
          control={form.control}
          name="bankName"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="utility-statement-bank-name">
                {t("reservations:utilitiesSheet.exportBankName")}
              </FieldLabel>
              <Input
                {...field}
                id="utility-statement-bank-name"
                aria-invalid={fieldState.invalid || undefined}
                autoComplete="off"
                placeholder={t(
                  "reservations:utilitiesSheet.exportBankNamePlaceholder",
                )}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="accountName"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="utility-statement-account-name">
                {t("reservations:utilitiesSheet.exportAccountName")}
              </FieldLabel>
              <Input
                {...field}
                id="utility-statement-account-name"
                aria-invalid={fieldState.invalid || undefined}
                autoComplete="off"
                placeholder={t(
                  "reservations:utilitiesSheet.exportAccountNamePlaceholder",
                )}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="accountNumber"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="utility-statement-account-number">
                {t("reservations:utilitiesSheet.exportAccountNumber")}
              </FieldLabel>
              <Input
                {...field}
                id="utility-statement-account-number"
                aria-invalid={fieldState.invalid || undefined}
                autoComplete="off"
                placeholder={t(
                  "reservations:utilitiesSheet.exportAccountNumberPlaceholder",
                )}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter className="mx-0 mb-0 rounded-none border-t-0 bg-transparent p-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" disabled={exportPending}>
          {t("reservations:utilitiesSheet.exportConfirm")}
        </Button>
      </DialogFooter>
    </form>
  );
}
