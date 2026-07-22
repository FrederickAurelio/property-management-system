/* anchor: Linear session login / Stripe sign-in, diverge: Outfit wordmark + warm primary CTA */
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
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
  staffLogin,
  staffSessionQueryKey,
} from "@/lib/api";

const loginSchema = z.object({
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
    ),
  password: z
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

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

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
    onSuccess: (admin) => {
      form.reset({ username: "", password: "" });
      setShowPassword(false);
      queryClient.setQueryData(staffSessionQueryKey, admin);
      handleSuccess("Signed in");
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
              <FieldLabel htmlFor="staff-login-username">Username</FieldLabel>
              <Input
                {...field}
                id="staff-login-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="front.desk"
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
              <FieldLabel htmlFor="staff-login-password">Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  {...field}
                  id="staff-login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
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
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
