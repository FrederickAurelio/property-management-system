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

const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(
      STAFF_USERNAME_MIN,
      `Username must be at least ${STAFF_USERNAME_MIN} characters`,
    )
    .max(
      STAFF_USERNAME_MAX,
      `Username must be at most ${STAFF_USERNAME_MAX} characters`,
    )
    .regex(
      STAFF_USERNAME_PATTERN,
      "Use letters, numbers, dots, hyphens, or underscores",
    ),
  currentPassword: z.union([
    z.literal(""),
    z
      .string()
      .min(
        STAFF_PASSWORD_MIN,
        `Password must be at least ${STAFF_PASSWORD_MIN} characters`,
      )
      .max(
        STAFF_PASSWORD_MAX,
        `Password must be at most ${STAFF_PASSWORD_MAX} characters`,
      ),
  ]),
});

type UsernameValues = z.infer<typeof usernameSchema>;

type ChangeUsernameFormProps = {
  currentUsername: string;
};

export function ChangeUsernameForm({
  currentUsername,
}: ChangeUsernameFormProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

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
      handleSuccess("Username updated");
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
            handleSuccess("Username unchanged");
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
                <FieldLabel htmlFor="settings-username">Username</FieldLabel>
                <FieldDescription>
                  Used to sign in. Letters, numbers, and . _ - only.
                </FieldDescription>
                <Input
                  {...field}
                  id="settings-username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="front.desk"
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
            Save username
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
            <DialogTitle>Change username?</DialogTitle>
            <DialogDescription>
              {pendingUsername ? (
                <>
                  Your sign-in name will change from{" "}
                  <span className="font-medium text-foreground">
                    {currentUsername}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-foreground">
                    {pendingUsername}
                  </span>
                  . Enter your current password to confirm.
                </>
              ) : (
                "Enter your current password to confirm."
              )}
            </DialogDescription>
          </DialogHeader>

          <Controller
            name="currentPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-username-current-password">
                  Current password
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
              Cancel
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
                      message: "Current password is required",
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
                  Changing…
                </>
              ) : (
                "Change username"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
