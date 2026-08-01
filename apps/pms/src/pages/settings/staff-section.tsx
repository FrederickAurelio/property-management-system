/* anchor: Stripe-data team table / Linear members, diverge: soft revoke via isActive */
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminRole,
  ApiError,
  STAFF_PASSWORD_MAX,
  STAFF_PASSWORD_MIN,
  STAFF_USERNAME_MAX,
  STAFF_USERNAME_MIN,
  STAFF_USERNAME_PATTERN,
  isApiFieldError,
  type StaffAdmin,
} from "@cabin/api-contract";
import type { TFunction } from "i18next";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { QueryErrorPanel } from "@/components/query-error-panel";
import i18n from "@/i18n";
import { ReauthPasswordDialog } from "@/components/reauth-password-dialog";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  applyApiFieldError,
  changeAdminRole,
  createAdmin,
  handleError,
  handleSuccess,
  listAdmins,
  setAdminActive,
  staffAdminsQueryKey,
  syncStaffAdminCaches,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  countActiveSuperAdmins,
  formatRole,
  type StaffRow,
} from "./staff-utils";

function createStaffSchema(t: TFunction) {
  return z.object({
    username: z
      .string()
      .trim()
      .min(
        STAFF_USERNAME_MIN,
        t("settings:staffSection.createDialog.validation.usernameMin", {
          min: STAFF_USERNAME_MIN,
        }),
      )
      .max(
        STAFF_USERNAME_MAX,
        t("settings:staffSection.createDialog.validation.usernameMax", {
          max: STAFF_USERNAME_MAX,
        }),
      )
      .regex(
        STAFF_USERNAME_PATTERN,
        t("settings:staffSection.createDialog.validation.usernamePattern"),
      ),
    password: z
      .string()
      .min(
        STAFF_PASSWORD_MIN,
        t("settings:staffSection.createDialog.validation.passwordMin", {
          min: STAFF_PASSWORD_MIN,
        }),
      )
      .max(
        STAFF_PASSWORD_MAX,
        t("settings:staffSection.createDialog.validation.passwordMax", {
          max: STAFF_PASSWORD_MAX,
        }),
      ),
    role: z.enum([
      AdminRole.SUPER_ADMIN,
      AdminRole.ADMIN,
      AdminRole.FRONT_DESK,
    ]),
  });
}

type CreateValues = z.infer<ReturnType<typeof createStaffSchema>>;

type StaffSectionProps = {
  currentAdmin: StaffAdmin;
};

type PendingAction =
  | { kind: "create"; values: CreateValues }
  | { kind: "role"; target: StaffRow; role: AdminRole }
  | { kind: "revoke"; target: StaffRow }
  | { kind: "restore"; target: StaffRow };

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(iso));
}

function currentPasswordMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || !isApiFieldError(error.details)) {
    return null;
  }
  if (error.details.field !== "currentPassword") return null;
  return (
    error.message ||
    i18n.t("settings:staffSection.reauth.currentPasswordIncorrect")
  );
}

export function StaffSection({ currentAdmin }: StaffSectionProps) {
  const { t } = useTranslation(["settings", "common"]);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<StaffRow | null>(null);
  const [nextRole, setNextRole] = useState<AdminRole>(AdminRole.FRONT_DESK);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reauthServerError, setReauthServerError] = useState<string | null>(
    null,
  );

  const createSchema = createStaffSchema(t);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema as never),
    defaultValues: {
      username: "",
      password: "",
      role: AdminRole.FRONT_DESK,
    },
  });

  const listQuery = useQuery({
    queryKey: staffAdminsQueryKey,
    queryFn: listAdmins,
  });

  const staff = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const activeSuperCount = useMemo(
    () => countActiveSuperAdmins(staff),
    [staff],
  );

  function isLastActiveSuper(row: StaffRow): boolean {
    return (
      row.role === AdminRole.SUPER_ADMIN &&
      row.isActive &&
      activeSuperCount <= 1
    );
  }

  function closeReauth(options?: { reopenCreate?: boolean }) {
    const reopenCreate = options?.reopenCreate === true;
    setPending(null);
    setReauthServerError(null);
    if (reopenCreate) {
      setCreateOpen(true);
    }
  }

  const createMutation = useMutation({
    mutationFn: createAdmin,
    onSuccess: (admin) => {
      createForm.reset({
        username: "",
        password: "",
        role: AdminRole.FRONT_DESK,
      });
      setCreateOpen(false);
      closeReauth();
      syncStaffAdminCaches(queryClient, admin);
      handleSuccess(
        t("settings:staffSection.toasts.created", {
          username: admin.username,
        }),
      );
    },
    onError: (error) => {
      const passwordMsg = currentPasswordMessage(error);
      if (passwordMsg) {
        setReauthServerError(passwordMsg);
        return;
      }
      if (
        error instanceof ApiError &&
        isApiFieldError(error.details) &&
        error.details.field === "username"
      ) {
        closeReauth({ reopenCreate: true });
        applyApiFieldError(error, createForm.setError);
        return;
      }
      handleError(error);
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({
      id,
      role,
      currentPassword,
    }: {
      id: string;
      role: AdminRole;
      currentPassword: string;
    }) => changeAdminRole(id, { role, currentPassword }),
    onSuccess: (admin) => {
      setRoleTarget(null);
      closeReauth();
      syncStaffAdminCaches(queryClient, admin);
      handleSuccess(
        t("settings:staffSection.toasts.roleUpdated", {
          username: admin.username,
          role: formatRole(admin.role),
        }),
      );
    },
    onError: (error) => {
      const passwordMsg = currentPasswordMessage(error);
      if (passwordMsg) {
        setReauthServerError(passwordMsg);
        return;
      }
      handleError(error);
    },
  });

  const activeMutation = useMutation({
    mutationFn: ({
      id,
      isActive,
      currentPassword,
    }: {
      id: string;
      isActive: boolean;
      currentPassword: string;
    }) => setAdminActive(id, { isActive, currentPassword }),
    onSuccess: (admin) => {
      closeReauth();
      syncStaffAdminCaches(queryClient, admin);
      handleSuccess(
        admin.isActive
          ? t("settings:staffSection.toasts.restored", {
              username: admin.username,
            })
          : t("settings:staffSection.toasts.revoked", {
              username: admin.username,
            }),
      );
    },
    onError: (error) => {
      const passwordMsg = currentPasswordMessage(error);
      if (passwordMsg) {
        setReauthServerError(passwordMsg);
        return;
      }
      handleError(error);
    },
  });

  const isMutating =
    createMutation.isPending ||
    roleMutation.isPending ||
    activeMutation.isPending;

  function submitReauth(currentPassword: string) {
    if (!pending) return;
    if (pending.kind === "create") {
      createMutation.mutate({
        ...pending.values,
        currentPassword,
      });
      return;
    }
    if (pending.kind === "role") {
      roleMutation.mutate({
        id: pending.target.id,
        role: pending.role,
        currentPassword,
      });
      return;
    }
    if (pending.kind === "revoke") {
      activeMutation.mutate({
        id: pending.target.id,
        isActive: false,
        currentPassword,
      });
      return;
    }
    activeMutation.mutate({
      id: pending.target.id,
      isActive: true,
      currentPassword,
    });
  }

  const reauthCopy = useMemo(() => {
    if (!pending) {
      return {
        title: t("settings:staffSection.reauth.defaultTitle"),
        description: t("settings:staffSection.reauth.defaultDescription"),
        confirmLabel: t("settings:staffSection.reauth.defaultConfirm"),
        variant: "default" as const,
      };
    }
    if (pending.kind === "create") {
      return {
        title: t("settings:staffSection.reauth.createTitle"),
        description: t("settings:staffSection.reauth.createDescription", {
          username: pending.values.username,
          role: formatRole(pending.values.role),
        }),
        confirmLabel: t("settings:staffSection.reauth.createConfirm"),
        variant: "default" as const,
      };
    }
    if (pending.kind === "role") {
      return {
        title: t("settings:staffSection.reauth.roleTitle"),
        description: t("settings:staffSection.reauth.roleDescription", {
          username: pending.target.username,
          role: formatRole(pending.role),
        }),
        confirmLabel: t("settings:staffSection.reauth.roleConfirm"),
        variant: "default" as const,
      };
    }
    if (pending.kind === "revoke") {
      return {
        title: t("settings:staffSection.reauth.revokeTitle"),
        description: t("settings:staffSection.reauth.revokeDescription", {
          username: pending.target.username,
        }),
        confirmLabel: t("settings:staffSection.reauth.revokeConfirm"),
        variant: "destructive" as const,
      };
    }
    return {
      title: t("settings:staffSection.reauth.restoreTitle"),
      description: t("settings:staffSection.reauth.restoreDescription", {
        username: pending.target.username,
      }),
      confirmLabel: t("settings:staffSection.reauth.restoreConfirm"),
      variant: "default" as const,
    };
  }, [pending, t]);

  if (listQuery.isPending) {
    return <StaffListSkeleton />;
  }

  if (listQuery.isError) {
    return (
      <QueryErrorPanel
        message={t("settings:staffSection.loadError")}
        onRetry={() => {
          void listQuery.refetch();
        }}
        isRetrying={listQuery.isFetching}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("settings:staffSection.helperText")}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            createForm.reset({
              username: "",
              password: "",
              role: AdminRole.FRONT_DESK,
            });
            setCreateOpen(true);
          }}
        >
          <PlusIcon data-icon="inline-start" />
          {t("settings:staffSection.addStaff")}
        </Button>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("settings:staffSection.table.username")}</TableHead>
              <TableHead>{t("settings:staffSection.table.role")}</TableHead>
              <TableHead>{t("settings:staffSection.table.status")}</TableHead>
              <TableHead>{t("settings:staffSection.table.created")}</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">
                  {t("settings:staffSection.table.actions")}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((row) => {
              const isSelf = row.id === currentAdmin.id;
              const lastSuper = isLastActiveSuper(row);

              return (
                <TableRow
                  key={row.id}
                  className={cn(!row.isActive && "opacity-60")}
                >
                  <TableCell className="min-w-0 font-medium">
                    <span className="truncate">{row.username}</span>
                    {isSelf && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {t("settings:staffSection.you")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatRole(row.role)}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "secondary" : "outline"}>
                      {row.isActive
                        ? t("settings:staffSection.active")
                        : t("settings:staffSection.revoked")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <StaffRowMenu
                      row={row}
                      isSelf={isSelf}
                      lastSuper={lastSuper}
                      onChangeRole={() => {
                        setNextRole(row.role);
                        setRoleTarget(row);
                      }}
                      onRevoke={() => {
                        setPending({ kind: "revoke", target: row });
                      }}
                      onRestore={() => {
                        setPending({ kind: "restore", target: row });
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {staff.map((row) => {
          const isSelf = row.id === currentAdmin.id;
          const lastSuper = isLastActiveSuper(row);

          return (
            <li
              key={row.id}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-3",
                !row.isActive && "opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {row.username}
                  {isSelf && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t("settings:staffSection.you")}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatRole(row.role)} · {formatDate(row.createdAt)}
                </p>
                <div className="mt-2">
                  <Badge variant={row.isActive ? "secondary" : "outline"}>
                    {row.isActive
                      ? t("settings:staffSection.active")
                      : t("settings:staffSection.revoked")}
                  </Badge>
                </div>
              </div>
              <StaffRowMenu
                row={row}
                isSelf={isSelf}
                lastSuper={lastSuper}
                onChangeRole={() => {
                  setNextRole(row.role);
                  setRoleTarget(row);
                }}
                onRevoke={() => {
                  setPending({ kind: "revoke", target: row });
                }}
                onRestore={() => {
                  setPending({ kind: "restore", target: row });
                }}
              />
            </li>
          );
        })}
      </ul>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (isMutating) return;
          setCreateOpen(open);
        }}
      >
        <DialogContent dismissOnOutsideClick={false}>
          <DialogHeader>
            <DialogTitle>
              {t("settings:staffSection.createDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("settings:staffSection.createDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            id="create-staff"
            onSubmit={createForm.handleSubmit((values) => {
              setReauthServerError(null);
              setPending({ kind: "create", values });
              setCreateOpen(false);
            })}
          >
            <FieldGroup>
              <Controller
                name="username"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="create-staff-username">
                      {t("settings:staffSection.createDialog.usernameLabel")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="create-staff-username"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder={t(
                        "settings:staffSection.createDialog.usernamePlaceholder",
                      )}
                      aria-invalid={fieldState.invalid}
                      className="text-base md:text-sm"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="password"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="create-staff-password">
                      {t("settings:staffSection.createDialog.passwordLabel")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="create-staff-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      aria-invalid={fieldState.invalid}
                      className="text-base md:text-sm"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="role"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>
                      {t("settings:staffSection.createDialog.roleLabel")}
                    </FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        if (value) field.onChange(value);
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AdminRole.FRONT_DESK}>
                          {t("settings:roles.frontDesk")}
                        </SelectItem>
                        <SelectItem value={AdminRole.ADMIN}>
                          {t("settings:roles.admin")}
                        </SelectItem>
                        <SelectItem value={AdminRole.SUPER_ADMIN}>
                          {t("settings:roles.superAdmin")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
              }}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" form="create-staff">
              {t("common:actions.continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={roleTarget !== null}
        onOpenChange={(open) => {
          if (isMutating) return;
          if (!open) setRoleTarget(null);
        }}
      >
        <DialogContent dismissOnOutsideClick={false}>
          <DialogHeader>
            <DialogTitle>
              {t("settings:staffSection.roleDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {roleTarget &&
                t("settings:staffSection.roleDialog.description", {
                  username: roleTarget.username,
                })}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>
              {t("settings:staffSection.roleDialog.roleLabel")}
            </FieldLabel>
            <Select
              value={nextRole}
              onValueChange={(value) => {
                if (value) setNextRole(value as AdminRole);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AdminRole.FRONT_DESK}>
                  {t("settings:roles.frontDesk")}
                </SelectItem>
                <SelectItem value={AdminRole.ADMIN}>
                  {t("settings:roles.admin")}
                </SelectItem>
                <SelectItem value={AdminRole.SUPER_ADMIN}>
                  {t("settings:roles.superAdmin")}
                </SelectItem>
              </SelectContent>
            </Select>
            {roleTarget &&
              isLastActiveSuper(roleTarget) &&
              nextRole !== AdminRole.SUPER_ADMIN && (
                <p className="text-sm text-destructive">
                  {t("settings:staffSection.roleDialog.lastSuperAdminWarning")}
                </p>
              )}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRoleTarget(null);
              }}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                !!roleTarget &&
                isLastActiveSuper(roleTarget) &&
                nextRole !== AdminRole.SUPER_ADMIN
              }
              onClick={() => {
                if (!roleTarget) return;
                setReauthServerError(null);
                setPending({
                  kind: "role",
                  target: roleTarget,
                  role: nextRole,
                });
                setRoleTarget(null);
              }}
            >
              {t("common:actions.continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReauthPasswordDialog
        key={
          pending
            ? `${pending.kind}-${"target" in pending ? pending.target.id : pending.values.username}`
            : "closed"
        }
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeReauth({ reopenCreate: pending?.kind === "create" });
          }
        }}
        title={reauthCopy.title}
        description={reauthCopy.description}
        confirmLabel={reauthCopy.confirmLabel}
        variant={reauthCopy.variant}
        isPending={isMutating}
        serverError={reauthServerError}
        onClearServerError={() => {
          setReauthServerError(null);
        }}
        onConfirm={submitReauth}
      />
    </div>
  );
}

function StaffListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="hidden rounded-lg border border-border md:block">
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <li key={index}>
            <Skeleton className="h-20 w-full rounded-lg" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffRowMenu({
  row,
  isSelf,
  lastSuper,
  onChangeRole,
  onRevoke,
  onRestore,
}: {
  row: StaffRow;
  isSelf: boolean;
  lastSuper: boolean;
  onChangeRole: () => void;
  onRevoke: () => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("settings:staffSection.actionsFor", {
            username: row.username,
          })}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={isSelf || !row.isActive}
          onClick={onChangeRole}
        >
          {t("settings:staffSection.changeRole")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row.isActive ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={isSelf || lastSuper}
            onClick={onRevoke}
          >
            {t("settings:staffSection.revokeAccess")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onRestore}>
            {t("settings:staffSection.restoreAccess")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
