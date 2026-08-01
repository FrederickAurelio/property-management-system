/* anchor: Linear settings form, diverge: password re-auth in confirm Dialog */
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  STAFF_PASSWORD_MAX,
  STAFF_PASSWORD_MIN,
  STAFF_USERNAME_MAX,
  STAFF_USERNAME_MIN,
  STAFF_USERNAME_PATTERN,
  isApiFieldError,
} from "@cabin/api-contract";
import type { TFunction } from "i18next";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  staffChangeUsername,
  staffSessionQueryKey,
} from "@/lib/api";

function createUsernameSchema(t: TFunction) {
  return z.object({
    username: z
      .string()
      .trim()
      .min(
        STAFF_USERNAME_MIN,
        t("settings:changeUsername.validation.usernameMin", {
          min: STAFF_USERNAME_MIN,
        }),
      )
      .max(
        STAFF_USERNAME_MAX,
        t("settings:changeUsername.validation.usernameMax", {
          max: STAFF_USERNAME_MAX,
        }),
      )
      .regex(
        STAFF_USERNAME_PATTERN,
        t("settings:changeUsername.validation.usernamePattern"),
      ),
    currentPassword: z.union([
      z.literal(""),
      z
        .string()
        .min(
          STAFF_PASSWORD_MIN,
          t("settings:changeUsername.validation.currentPasswordMin", {
            min: STAFF_PASSWORD_MIN,
          }),
        )
        .max(
          STAFF_PASSWORD_MAX,
          t("settings:changeUsername.validation.currentPasswordMax", {
            max: STAFF_PASSWORD_MAX,
          }),
        ),
    ]),
  });
}

type UsernameValues = z.infer<ReturnType<typeof createUsernameSchema>>;

type ChangeUsernameFormProps = {
  currentUsername: string;
};

export function ChangeUsernameForm({
  currentUsername,
}: ChangeUsernameFormProps) {
  const { t } = useTranslation(["settings", "common", "auth"]);
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  const usernameSchema = createUsernameSchema(t);

  const form = useForm<UsernameValues>({
    resolver: zodResolver(usernameSchema as never),
    defaultValues: { username: currentUsername, currentPassword: "" },
  });

  useEffect(() => {
    form.reset({ username: currentUsername, currentPassword: "" });
  }, [currentUsername, form]);

  const mutation = useMutation({
    mutationFn: staffChangeUsername,
    onSuccess: (admin) => {
      form.reset({ username: admin.username, currentPassword: "" });
      setPendingUsername(null);
      setConfirmOpen(false);
      setShowPassword(false);
      queryClient.setQueryData(staffSessionQueryKey, admin);
      handleSuccess(t("settings:changeUsername.updated"));
    },
    onError: (error) => {
      const handled = applyApiFieldError(error, form.setError);
      if (
        handled &&
        error instanceof ApiError &&
        isApiFieldError(error.details) &&
        error.details.field === "username"
      ) {
        setConfirmOpen(false);
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          if (values.username === currentUsername) {
            handleSuccess(t("settings:changeUsername.unchanged"));
            return;
          }
          setPendingUsername(values.username);
          form.setValue("currentPassword", "");
          form.clearErrors("currentPassword");
          setConfirmOpen(true);
        })}
      >
        <FieldGroup>
          <Controller
            name="username"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-username">
                  {t("settings:changeUsername.usernameLabel")}
                </FieldLabel>
                <FieldDescription>
                  {t("settings:changeUsername.usernameDescription")}
                </FieldDescription>
                <Input
                  {...field}
                  id="settings-username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t("settings:changeUsername.usernamePlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  className="max-w-sm text-base md:text-sm"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Button type="submit" className="w-fit" disabled={isPending}>
            {t("settings:changeUsername.save")}
          </Button>
        </FieldGroup>
      </form>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (isPending) return;
          setConfirmOpen(open);
          if (!open) {
            setPendingUsername(null);
            form.setValue("currentPassword", "");
            form.clearErrors("currentPassword");
            setShowPassword(false);
          }
        }}
      >
        <DialogContent showCloseButton={false} dismissOnOutsideClick={false}>
          <DialogHeader>
            <DialogTitle>
              {t("settings:changeUsername.confirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {pendingUsername
                ? t("settings:changeUsername.confirmDescriptionWithPending", {
                    from: currentUsername,
                    to: pendingUsername,
                  })
                : t("settings:changeUsername.confirmDescriptionDefault")}
            </DialogDescription>
          </DialogHeader>

          <Controller
            name="currentPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-username-current-password">
                  {t("settings:changeUsername.currentPasswordLabel")}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...field}
                    id="settings-username-current-password"
                    type={showPassword ? "text" : "password"}
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
                        showPassword
                          ? t("auth:form.hidePassword")
                          : t("auth:form.showPassword")
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
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => {
                void form.trigger("currentPassword").then((ok) => {
                  if (!ok || !pendingUsername) return;
                  const currentPassword = form.getValues("currentPassword");
                  if (!currentPassword) {
                    form.setError("currentPassword", {
                      message: t(
                        "settings:changeUsername.currentPasswordRequired",
                      ),
                    });
                    return;
                  }
                  mutation.mutate({
                    username: pendingUsername,
                    currentPassword,
                  });
                });
              }}
            >
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  {t("settings:changeUsername.changing")}
                </>
              ) : (
                t("settings:changeUsername.confirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
