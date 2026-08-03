/* anchor: Linear settings / Stripe team, diverge: account + SUPER_ADMIN staff in one page */
import { useQuery } from "@tanstack/react-query";
import { AdminRole } from "@cabin/api-contract";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { staffSession } from "@/lib/api";
import { staffSessionQueryKey } from "@/lib/api/query-keys";
import { LanguageSwitcher } from "@/components/language-switcher";
import { StaffLogoutButton } from "@/components/layout/staff-logout-button";
import { ChangePasswordForm } from "./change-password-form";
import { ChangeUsernameForm } from "./change-username-form";
import { StaffSection } from "./staff-section";
import { ThemePreferenceSelect } from "./theme-preference-select";
import { ArchiveSmokeUpload } from "./archive-smoke-upload";

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
  const { t } = useTranslation(["settings", "common"]);
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
        title={t("settings:profile.title")}
        description={t("settings:profile.description")}
      >
        <ChangeUsernameForm
          key={staff.username}
          currentUsername={staff.username}
        />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t("settings:password.title")}
        description={t("settings:password.description")}
      >
        <ChangePasswordForm />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t("settings:appearance.title")}
        description={t("settings:appearance.description")}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {t("settings:appearance.themeLabel")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings:appearance.themeDescription")}
              </p>
            </div>
            <ThemePreferenceSelect />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {t("common:language.label")}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </SettingsSection>

      {canManageStaff && (
        <>
          <Separator />
          <SettingsSection
            title={t("settings:staff.title")}
            description={t("settings:staff.description")}
          >
            <StaffSection currentAdmin={staff} />
          </SettingsSection>
        </>
      )}

      <Separator />

      <SettingsSection
        title="Archive upload smoke test (temp)"
        description="Self-hosted Garage proofs — not inventory media. Remove after real proof UI."
      >
        <ArchiveSmokeUpload />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t("settings:session.title")}
        description={t("settings:session.description")}
      >
        <StaffLogoutButton
          variant="outline"
          className="w-full max-w-xs justify-center sm:w-fit"
        />
      </SettingsSection>
    </div>
  );
}
