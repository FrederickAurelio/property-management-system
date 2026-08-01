/* anchor: Linear settings form, diverge: current + new + confirm password */
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { STAFF_PASSWORD_MAX, STAFF_PASSWORD_MIN } from "@cabin/api-contract";
import type { TFunction } from "i18next";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
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

function createPasswordSchema(t: TFunction) {
  return z
    .object({
      currentPassword: z
        .string()
        .min(1, t("settings:changePassword.validation.currentRequired"))
        .max(
          STAFF_PASSWORD_MAX,
          t("settings:changePassword.validation.currentMax", {
            max: STAFF_PASSWORD_MAX,
          }),
        ),
      newPassword: z
        .string()
        .min(
          STAFF_PASSWORD_MIN,
          t("settings:changePassword.validation.newMin", {
            min: STAFF_PASSWORD_MIN,
          }),
        )
        .max(
          STAFF_PASSWORD_MAX,
          t("settings:changePassword.validation.newMax", {
            max: STAFF_PASSWORD_MAX,
          }),
        ),
      confirmPassword: z
        .string()
        .min(1, t("settings:changePassword.validation.confirmRequired")),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: t("settings:changePassword.validation.mismatch"),
      path: ["confirmPassword"],
    })
    .refine((values) => values.newPassword !== values.currentPassword, {
      message: t("settings:changePassword.validation.sameAsCurrent"),
      path: ["newPassword"],
    });
}

type PasswordValues = z.infer<ReturnType<typeof createPasswordSchema>>;

export function ChangePasswordForm() {
  const { t } = useTranslation(["settings", "auth"]);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const passwordSchema = createPasswordSchema(t);

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
      form.reset();
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setConfirmOpen(false);
      handleSuccess(t("settings:changePassword.updated"));
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
                  {t("settings:changePassword.currentPasswordLabel")}
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
                        showCurrent
                          ? t("auth:form.hidePassword")
                          : t("auth:form.showPassword")
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
                  {t("settings:changePassword.newPasswordLabel")}
                </FieldLabel>
                <FieldDescription>
                  {t("settings:changePassword.newPasswordDescription", {
                    min: STAFF_PASSWORD_MIN,
                  })}
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
                      aria-label={
                        showNew
                          ? t("auth:form.hidePassword")
                          : t("auth:form.showPassword")
                      }
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
                  {t("settings:changePassword.confirmPasswordLabel")}
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
                        showConfirm
                          ? t("auth:form.hidePassword")
                          : t("auth:form.showPassword")
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
                {t("settings:changePassword.submitting")}
              </>
            ) : (
              t("settings:changePassword.submit")
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
        title={t("settings:changePassword.confirmTitle")}
        description={t("settings:changePassword.confirmDescription")}
        confirmLabel={t("settings:changePassword.confirmLabel")}
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
