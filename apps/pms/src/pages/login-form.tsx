/* anchor: Linear session login / Stripe sign-in, diverge: Outfit wordmark + warm primary CTA */
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
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
  STAFF_PASSWORD_MAX,
  STAFF_PASSWORD_MIN,
  STAFF_USERNAME_MAX,
  STAFF_USERNAME_MIN,
} from "@cabin/api-contract";
import {
  handleError,
  handleSuccess,
  resetUnauthorizedStreak,
  staffLogin,
  staffSession,
  staffSessionQueryKey,
} from "@/lib/api";

function createLoginSchema(t: TFunction<"auth">) {
  return z.object({
    username: z
      .string()
      .trim()
      .min(
        STAFF_USERNAME_MIN,
        t("validation.usernameMin", { min: STAFF_USERNAME_MIN }),
      )
      .max(
        STAFF_USERNAME_MAX,
        t("validation.usernameMax", { max: STAFF_USERNAME_MAX }),
      ),
    password: z
      .string()
      .min(
        STAFF_PASSWORD_MIN,
        t("validation.passwordMin", { min: STAFF_PASSWORD_MIN }),
      )
      .max(
        STAFF_PASSWORD_MAX,
        t("validation.passwordMax", { max: STAFF_PASSWORD_MAX }),
      ),
  });
}

type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;

export function LoginForm() {
  const { t } = useTranslation(["auth"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const loginSchema = createLoginSchema(t);

  // Cast: @hookform/resolvers brands Zod minor as `0`; Zod 4.4 uses `4` (runtime OK).
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema as never),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: ({ username, password }: LoginValues) =>
      staffLogin(username, password),
    onSuccess: async () => {
      form.reset({ username: "", password: "" });
      setShowPassword(false);
      resetUnauthorizedStreak();
      try {
        // Verify session cookie before entering the app (setQueryData alone masked 401 loops).
        await queryClient.fetchQuery({
          queryKey: staffSessionQueryKey,
          queryFn: () => staffSession({ skipUnauthorizedRedirect: true }),
        });
      } catch (error) {
        queryClient.removeQueries({ queryKey: staffSessionQueryKey });
        handleError(error);
        return;
      }
      handleSuccess(t("toasts.signedIn"));
      void navigate("/", { replace: true });
    },
    onError: handleError,
  });

  const isPending = mutation.isPending;

  return (
    <form
      id="staff-login"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        mutation.mutate(values);
      })}
    >
      <FieldGroup>
        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="staff-login-username">
                {t("form.usernameLabel")}
              </FieldLabel>
              <Input
                {...field}
                id="staff-login-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t("form.usernamePlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isPending}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="staff-login-password">
                {t("form.passwordLabel")}
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  {...field}
                  id="staff-login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t("form.passwordPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={
                      showPassword
                        ? t("form.hidePassword")
                        : t("form.showPassword")
                    }
                    onClick={() => {
                      setShowPassword((prev) => !prev);
                    }}
                    disabled={isPending}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              {t("form.submitting")}
            </>
          ) : (
            t("form.submit")
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
