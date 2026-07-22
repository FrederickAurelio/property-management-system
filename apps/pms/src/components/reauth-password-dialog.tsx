/* anchor: Linear re-auth confirm, diverge: password field inside Dialog */
import { useId, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { STAFF_PASSWORD_MAX, STAFF_PASSWORD_MIN } from "@cabin/api-contract";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

const reauthSchema = z.object({
  currentPassword: z
    .string()
    .min(
      STAFF_PASSWORD_MIN,
      `Password must be at least ${STAFF_PASSWORD_MIN} characters`,
    )
    .max(
      STAFF_PASSWORD_MAX,
      `Password must be at most ${STAFF_PASSWORD_MAX} characters`,
    ),
});

type ReauthValues = z.infer<typeof reauthSchema>;

type ReauthPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  isPending?: boolean;
  /** Server field error for currentPassword (e.g. INVALID_CURRENT_PASSWORD). */
  serverError?: string | null;
  onClearServerError?: () => void;
  onConfirm: (currentPassword: string) => void;
};

export function ReauthPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "default",
  isPending = false,
  serverError = null,
  onClearServerError,
  onConfirm,
}: ReauthPasswordDialogProps) {
  const passwordId = useId();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<ReauthValues>({
    resolver: zodResolver(reauthSchema as never),
    defaultValues: { currentPassword: "" },
  });

  function resetLocal() {
    form.reset({ currentPassword: "" });
    setShowPassword(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        if (!next) {
          resetLocal();
          onClearServerError?.();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false} dismissOnOutsideClick={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Controller
          name="currentPassword"
          control={form.control}
          render={({ field, fieldState }) => {
            const message =
              fieldState.error?.message ?? serverError ?? undefined;
            const invalid = Boolean(message);

            return (
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor={passwordId}>Current password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...field}
                    id={passwordId}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={invalid}
                    disabled={isPending}
                    className="text-base md:text-sm"
                    onChange={(event) => {
                      field.onChange(event);
                      onClearServerError?.();
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      disabled={isPending}
                      onClick={() => {
                        setShowPassword((prev) => !prev);
                      }}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {invalid && (
                  <FieldError errors={[{ message }]} />
                )}
              </Field>
            );
          }}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              resetLocal();
              onClearServerError?.();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={isPending}
            onClick={() => {
              void form.trigger("currentPassword").then((ok) => {
                if (!ok) return;
                onConfirm(form.getValues("currentPassword"));
              });
            }}
          >
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                Confirming…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
