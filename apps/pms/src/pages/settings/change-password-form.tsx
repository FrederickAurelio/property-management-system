/* anchor: Linear settings form, diverge: current + new + confirm password */
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  STAFF_PASSWORD_MAX,
  STAFF_PASSWORD_MIN,
} from "@cabin/api-contract";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
  applyApiFieldError,
  handleSuccess,
  staffChangePassword,
} from "@/lib/api";

const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required")
      .max(
        STAFF_PASSWORD_MAX,
        `Password must be at most ${STAFF_PASSWORD_MAX} characters`,
      ),
    newPassword: z
      .string()
      .min(
        STAFF_PASSWORD_MIN,
        `New password must be at least ${STAFF_PASSWORD_MIN} characters`,
      )
      .max(
        STAFF_PASSWORD_MAX,
        `Password must be at most ${STAFF_PASSWORD_MAX} characters`,
      ),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: "New password must differ from the current one",
    path: ["newPassword"],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

export function ChangePasswordForm() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema as never),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const mutation = useMutation({
    mutationFn: staffChangePassword,
    onSuccess: () => {
      handleSuccess("Password updated");
      form.reset();
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setConfirmOpen(false);
    },
    onError: (error) => {
      setConfirmOpen(false);
      applyApiFieldError(error, form.setError);
    },
  });

  const isPending = mutation.isPending;

  return (
    <>
      <form
        noValidate
        onSubmit={form.handleSubmit(() => {
          setConfirmOpen(true);
        })}
      >
        <FieldGroup>
          <Controller
            name="currentPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-current-password">
                  Current password
                </FieldLabel>
                <InputGroup className="max-w-sm">
                  <InputGroupInput
                    {...field}
                    id="settings-current-password"
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    disabled={isPending}
                    className="text-base md:text-sm"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={
                        showCurrent ? "Hide password" : "Show password"
                      }
                      disabled={isPending}
                      onClick={() => {
                        setShowCurrent((prev) => !prev);
                      }}
                    >
                      {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="newPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-new-password">
                  New password
                </FieldLabel>
                <FieldDescription>
                  At least {STAFF_PASSWORD_MIN} characters.
                </FieldDescription>
                <InputGroup className="max-w-sm">
                  <InputGroupInput
                    {...field}
                    id="settings-new-password"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    disabled={isPending}
                    className="text-base md:text-sm"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={showNew ? "Hide password" : "Show password"}
                      disabled={isPending}
                      onClick={() => {
                        setShowNew((prev) => !prev);
                      }}
                    >
                      {showNew ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="confirmPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-confirm-password">
                  Confirm new password
                </FieldLabel>
                <InputGroup className="max-w-sm">
                  <InputGroupInput
                    {...field}
                    id="settings-confirm-password"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    disabled={isPending}
                    className="text-base md:text-sm"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={
                        showConfirm ? "Hide password" : "Show password"
                      }
                      disabled={isPending}
                      onClick={() => {
                        setShowConfirm((prev) => !prev);
                      }}
                    >
                      {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Button type="submit" className="w-fit" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </FieldGroup>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (isPending) return;
          setConfirmOpen(open);
        }}
        title="Update password?"
        description="Your password will change immediately. You’ll stay signed in on this device; other sessions may need the new password."
        confirmLabel="Update password"
        confirmDisabled={isPending}
        onConfirm={() => {
          const values = form.getValues();
          mutation.mutate({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          });
        }}
      />
    </>
  );
}
