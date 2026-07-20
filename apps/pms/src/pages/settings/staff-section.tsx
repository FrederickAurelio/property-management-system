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
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { QueryErrorPanel } from "@/components/query-error-panel";
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
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  countActiveSuperAdmins,
  formatRole,
  type StaffRow,
} from "./staff-utils";

const createSchema = z.object({
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
  role: z.enum([
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FRONT_DESK,
  ]),
});

type CreateValues = z.infer<typeof createSchema>;

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
  return error.message || "Current password is incorrect";
}

export function StaffSection({ currentAdmin }: StaffSectionProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<StaffRow | null>(null);
  const [nextRole, setNextRole] = useState<AdminRole>(AdminRole.FRONT_DESK);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reauthServerError, setReauthServerError] = useState<string | null>(
    null,
  );

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
      void queryClient.invalidateQueries({ queryKey: staffAdminsQueryKey });
      handleSuccess(`Created ${admin.username}`);
      createForm.reset({
        username: "",
        password: "",
        role: AdminRole.FRONT_DESK,
      });
      setCreateOpen(false);
      closeReauth();
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
      void queryClient.invalidateQueries({ queryKey: staffAdminsQueryKey });
      handleSuccess(`Updated ${admin.username} to ${formatRole(admin.role)}`);
      setRoleTarget(null);
      closeReauth();
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
      void queryClient.invalidateQueries({ queryKey: staffAdminsQueryKey });
      handleSuccess(
        admin.isActive
          ? `Restored access for ${admin.username}`
          : `Revoked access for ${admin.username}`,
      );
      closeReauth();
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
        title: "Confirm",
        description: "Enter your current password to confirm.",
        confirmLabel: "Confirm",
        variant: "default" as const,
      };
    }
    if (pending.kind === "create") {
      return {
        title: "Create staff?",
        description: (
          <>
            Create{" "}
            <span className="font-medium text-foreground">
              {pending.values.username}
            </span>{" "}
            as {formatRole(pending.values.role)}. Enter your current password to
            confirm.
          </>
        ),
        confirmLabel: "Create staff",
        variant: "default" as const,
      };
    }
    if (pending.kind === "role") {
      return {
        title: "Change role?",
        description: (
          <>
            Update{" "}
            <span className="font-medium text-foreground">
              {pending.target.username}
            </span>{" "}
            to {formatRole(pending.role)}. Enter your current password to
            confirm.
          </>
        ),
        confirmLabel: "Save role",
        variant: "default" as const,
      };
    }
    if (pending.kind === "revoke") {
      return {
        title: "Revoke access?",
        description: (
          <>
            <span className="font-medium text-foreground">
              {pending.target.username}
            </span>{" "}
            will not be able to sign in. The account stays in the list and can
            be restored later. Enter your current password to confirm.
          </>
        ),
        confirmLabel: "Revoke access",
        variant: "destructive" as const,
      };
    }
    return {
      title: "Restore access?",
      description: (
        <>
          <span className="font-medium text-foreground">
            {pending.target.username}
          </span>{" "}
          will be able to sign in again. Enter your current password to confirm.
        </>
      ),
      confirmLabel: "Restore access",
      variant: "default" as const,
    };
  }, [pending]);

  if (listQuery.isPending) {
    return <StaffListSkeleton />;
  }

  if (listQuery.isError) {
    return (
      <QueryErrorPanel
        message="Couldn’t load staff. Check your connection and try again."
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
          SUPER_ADMIN only. Revoking sets access inactive — the account stays
          for audit; it is not deleted.
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
          Add staff
        </Button>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
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
                        you
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatRole(row.role)}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "secondary" : "outline"}>
                      {row.isActive ? "Active" : "Revoked"}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
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
                      you
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatRole(row.role)} · {formatDate(row.createdAt)}
                </p>
                <div className="mt-2">
                  <Badge variant={row.isActive ? "secondary" : "outline"}>
                    {row.isActive ? "Active" : "Revoked"}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
            <DialogDescription>
              Creates a new admin account. They can sign in immediately.
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
                      Username
                    </FieldLabel>
                    <Input
                      {...field}
                      id="create-staff-username"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="front.desk"
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
                      Temporary password
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
                    <FieldLabel>Role</FieldLabel>
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
                          Front desk
                        </SelectItem>
                        <SelectItem value={AdminRole.ADMIN}>Admin</SelectItem>
                        <SelectItem value={AdminRole.SUPER_ADMIN}>
                          Super admin
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
              Cancel
            </Button>
            <Button type="submit" form="create-staff">
              Continue
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              {roleTarget && `Update access for ${roleTarget.username}.`}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>Role</FieldLabel>
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
                  Front desk
                </SelectItem>
                <SelectItem value={AdminRole.ADMIN}>Admin</SelectItem>
                <SelectItem value={AdminRole.SUPER_ADMIN}>
                  Super admin
                </SelectItem>
              </SelectContent>
            </Select>
            {roleTarget &&
              isLastActiveSuper(roleTarget) &&
              nextRole !== AdminRole.SUPER_ADMIN && (
                <p className="text-sm text-destructive">
                  You cannot demote the last active super admin.
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
              Cancel
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
              Continue
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${row.username}`}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={isSelf || !row.isActive}
          onClick={onChangeRole}
        >
          Change role
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row.isActive ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={isSelf || lastSuper}
            onClick={onRevoke}
          >
            Revoke access
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onRestore}>
            Restore access
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
