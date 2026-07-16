/* anchor: Stripe-data team table / Linear members, diverge: soft revoke via isActive */
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminRole, type PublicAdmin } from "@cabin/api-contract";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { handleSuccess } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  MOCK_STAFF,
  type StaffRow,
  countActiveSuperAdmins,
  formatRole,
} from "./mock-staff";

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(64, "Username must be at most 64 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Use letters, numbers, dots, hyphens, or underscores",
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  role: z.enum([
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.FRONT_DESK,
  ]),
});

type CreateValues = z.infer<typeof createSchema>;

type StaffSectionProps = {
  currentAdmin: PublicAdmin;
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(iso));
}

function withCurrentAdmin(
  rows: StaffRow[],
  current: PublicAdmin,
): StaffRow[] {
  const withoutDup = rows.filter(
    (row) =>
      row.id !== current.id &&
      row.username.toLowerCase() !== current.username.toLowerCase(),
  );
  return [current, ...withoutDup];
}

export function StaffSection({ currentAdmin }: StaffSectionProps) {
  const [rows, setRows] = useState<StaffRow[]>(() =>
    MOCK_STAFF.filter(
      (row) =>
        row.id !== currentAdmin.id &&
        row.username.toLowerCase() !== currentAdmin.username.toLowerCase(),
    ),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<StaffRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<StaffRow | null>(null);
  const [nextRole, setNextRole] = useState<AdminRole>(AdminRole.FRONT_DESK);

  const staff = useMemo(
    () => withCurrentAdmin(rows, currentAdmin),
    [rows, currentAdmin],
  );

  const activeSuperCount = useMemo(
    () => countActiveSuperAdmins(staff),
    [staff],
  );

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema as never),
    defaultValues: {
      username: "",
      password: "",
      role: AdminRole.FRONT_DESK,
    },
  });

  function isLastActiveSuper(row: StaffRow): boolean {
    return (
      row.role === AdminRole.SUPER_ADMIN &&
      row.isActive &&
      activeSuperCount <= 1
    );
  }

  function restoreAccess(row: StaffRow) {
    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id
          ? {
              ...item,
              isActive: true,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    handleSuccess(`Restored access for ${row.username} (preview)`);
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    setRows((prev) =>
      prev.map((item) =>
        item.id === revokeTarget.id
          ? {
              ...item,
              isActive: false,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    handleSuccess(`Revoked access for ${revokeTarget.username} (preview)`);
    setRevokeTarget(null);
  }

  function confirmRoleChange() {
    if (!roleTarget) return;
    if (
      roleTarget.role === AdminRole.SUPER_ADMIN &&
      nextRole !== AdminRole.SUPER_ADMIN &&
      isLastActiveSuper(roleTarget)
    ) {
      return;
    }
    setRows((prev) =>
      prev.map((item) =>
        item.id === roleTarget.id
          ? {
              ...item,
              role: nextRole,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    handleSuccess(
      `Updated ${roleTarget.username} to ${formatRole(nextRole)} (preview)`,
    );
    setRoleTarget(null);
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

      {/* Desktop table */}
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
                        setRevokeTarget(row);
                      }}
                      onRestore={() => {
                        restoreAccess(row);
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
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
                  setRevokeTarget(row);
                }}
                onRestore={() => {
                  restoreAccess(row);
                }}
              />
            </li>
          );
        })}
      </ul>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
              if (
                staff.some(
                  (row) =>
                    row.username.toLowerCase() === values.username.toLowerCase(),
                )
              ) {
                createForm.setError("username", {
                  message: "Username already taken",
                });
                return;
              }
              const created: StaffRow = {
                id: `admin_${crypto.randomUUID().slice(0, 8)}`,
                username: values.username,
                role: values.role,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setRows((prev) => [created, ...prev]);
              handleSuccess(`Created ${values.username} (preview)`);
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
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change role */}
      <Dialog
        open={roleTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRoleTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              {roleTarget &&
                `Update access for ${roleTarget.username}.`}
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
                <SelectItem
                  value={AdminRole.SUPER_ADMIN}
                  disabled={false}
                >
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
              onClick={confirmRoleChange}
            >
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke */}
      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke access</DialogTitle>
            <DialogDescription>
              {revokeTarget && (
                <>
                  <span className="font-medium text-foreground">
                    {revokeTarget.username}
                  </span>{" "}
                  will not be able to sign in. The account is kept for history
                  and can be restored later.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRevokeTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRevoke}
            >
              Revoke access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
