/* anchor: Linear settings / Stripe team, diverge: account + SUPER_ADMIN staff in one page */
import { useQuery } from "@tanstack/react-query";
import { AdminRole } from "@cabin/api-contract";
import { Separator } from "@/components/ui/separator";
import { staffSession } from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";
import { StaffLogoutButton } from "@/components/layout/staff-logout-button";
import { ChangePasswordForm } from "./change-password-form";
import { ChangeUsernameForm } from "./change-username-form";
import { StaffSection } from "./staff-section";
import { ThemePreferenceSelect } from "./theme-preference-select";

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { data: staff } = useQuery({
    queryKey: staffSessionQueryKey,
    queryFn: () => staffSession(),
  });

  if (!staff) {
    return null;
  }

  const canManageStaff = staff.role === AdminRole.SUPER_ADMIN;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 md:gap-10 md:p-6">
      <SettingsSection
        title="Profile"
        description="How you appear when signing in."
      >
        <ChangeUsernameForm currentUsername={staff.username} />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title="Password"
        description="Change the password for this account."
      >
        <ChangePasswordForm />
      </SettingsSection>

      <Separator />

      <SettingsSection title="Appearance" description="Display preference.">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">
              Light, dark, or match the system
            </p>
          </div>
          <ThemePreferenceSelect />
        </div>
      </SettingsSection>

      {canManageStaff && (
        <>
          <Separator />
          <SettingsSection
            title="Staff"
            description="Create accounts, change roles, and revoke access."
          >
            <StaffSection currentAdmin={staff} />
          </SettingsSection>
        </>
      )}

      <Separator />

      <SettingsSection
        title="Session"
        description="Sign out on this device."
      >
        <StaffLogoutButton
          variant="outline"
          className="w-full max-w-xs justify-center sm:w-fit"
        />
      </SettingsSection>
    </div>
  );
}
