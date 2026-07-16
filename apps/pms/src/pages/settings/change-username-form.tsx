/* anchor: Linear settings form, diverge: RHF + Zod Field pattern from login */
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { handleSuccess } from "@/lib/api";

const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(64, "Username must be at most 64 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Use letters, numbers, dots, hyphens, or underscores",
    ),
});

type UsernameValues = z.infer<typeof usernameSchema>;

type ChangeUsernameFormProps = {
  currentUsername: string;
};

export function ChangeUsernameForm({
  currentUsername,
}: ChangeUsernameFormProps) {
  const form = useForm<UsernameValues>({
    resolver: zodResolver(usernameSchema as never),
    defaultValues: { username: currentUsername },
  });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (values.username === currentUsername) {
          handleSuccess("Username unchanged");
          return;
        }
        // UI-only — wire to API later
        handleSuccess("Username updated (preview)");
        form.reset({ username: values.username });
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
                className="max-w-sm text-base md:text-sm"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" className="w-fit">
          Save username
        </Button>
      </FieldGroup>
    </form>
  );
}
