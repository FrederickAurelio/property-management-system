/* anchor: Linear settings form, diverge: current + new + confirm password */
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { handleSuccess } from "@/lib/api";

const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required")
      .max(128, "Password must be at most 128 characters"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
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
                    className="text-base md:text-sm"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={
                        showCurrent ? "Hide password" : "Show password"
                      }
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
                <FieldDescription>At least 8 characters.</FieldDescription>
                <InputGroup className="max-w-sm">
                  <InputGroupInput
                    {...field}
                    id="settings-new-password"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    className="text-base md:text-sm"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={showNew ? "Hide password" : "Show password"}
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
                    className="text-base md:text-sm"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={
                        showConfirm ? "Hide password" : "Show password"
                      }
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
          <Button type="submit" className="w-fit">
            Update password
          </Button>
        </FieldGroup>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Update password?"
        description="Your password will change immediately. You’ll stay signed in on this device; other sessions may need the new password."
        confirmLabel="Update password"
        onConfirm={() => {
          // UI-only — wire to API later
          handleSuccess("Password updated (preview)");
          form.reset();
          setShowCurrent(false);
          setShowNew(false);
          setShowConfirm(false);
        }}
      />
    </>
  );
}
