/* anchor: Linear-dense ledger, diverge: period expenses like reports chrome */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  type StaffPropertyExpense,
} from "@cabin/api-contract";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { WalletIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { InfiniteListFooter } from "@/components/infinite-list-footer";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
  deletePropertyExpense,
  getNextPageParamFromPageInfo,
  handleError,
  handleSuccess,
  INFINITE_INITIAL_PAGE,
  invalidateExpenseCaches,
  listPropertyExpenses,
  listPropertyOptions,
  listUnits,
  staffExpensesListQueryKey,
  staffPropertiesOptionsQueryKey,
} from "@/lib/api";
import { staffUnitsListQueryKeyPrefix } from "@/lib/api/query-keys";
import { readLastPropertyId, writeLastPropertyId } from "@/lib/last-property";
import { opsTodayYmd, resolvePropertyTimezone } from "@/lib/ops-date";
import { formatIdr } from "@/pages/properties/inventory-types";
import {
  activePresetId,
  defaultMonthToDate,
  rangeForPreset,
} from "@/pages/reports/reports-period";
import { ExpensesFilterBar } from "./expenses-filter-bar";
import { formatExpenseCategory } from "./expenses-format";
import { ExpensesSheet } from "./expenses-sheet";

export function ExpensesPage() {
  const { t } = useTranslation(["expenses", "common"]);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffPropertyExpense | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<StaffPropertyExpense | null>(
    null,
  );

  const propertyId = searchParams.get("propertyId") ?? "";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const optionsQuery = useQuery({
    queryKey: staffPropertiesOptionsQueryKey(),
    queryFn: listPropertyOptions,
  });

  const timezone = useMemo(
    () => resolvePropertyTimezone(optionsQuery.data ?? [], propertyId),
    [optionsQuery.data, propertyId],
  );
  const today = useMemo(() => opsTodayYmd(timezone), [timezone]);
  const defaults = useMemo(() => defaultMonthToDate(today), [today]);
  const prevTodayRef = useRef(today);

  const from =
    fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)
      ? fromParam
      : defaults.from;
  const to =
    toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : defaults.to;
  const rangeOk = from <= to;

  const setChrome = useCallback(
    (next: { propertyId?: string; from?: string; to?: string }) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          const pid = next.propertyId ?? p.get("propertyId") ?? "";
          const nextFrom = next.from ?? p.get("from") ?? defaults.from;
          const nextTo = next.to ?? p.get("to") ?? defaults.to;
          if (pid) p.set("propertyId", pid);
          else p.delete("propertyId");
          p.set("from", nextFrom);
          p.set("to", nextTo);
          return p;
        },
        { replace: true },
      );
    },
    [defaults.from, defaults.to, setSearchParams],
  );

  useEffect(() => {
    const needsPeriodDefaults = !fromParam || !toParam;
    if (!optionsQuery.isSuccess || optionsQuery.data.length === 0) {
      return;
    }
    const propertyOk =
      Boolean(propertyId) && optionsQuery.data.some((p) => p.id === propertyId);
    const prevToday = prevTodayRef.current;
    const todayChanged = prevToday !== today;

    if (propertyOk) {
      writeLastPropertyId(propertyId);
      if (needsPeriodDefaults) {
        setChrome({ from: defaults.from, to: defaults.to });
        prevTodayRef.current = today;
        return;
      }
      if (todayChanged) {
        const preset = activePresetId(from, to, prevToday);
        if (preset) {
          const r = rangeForPreset(preset, today);
          setChrome({ from: r.from, to: r.to });
        }
        prevTodayRef.current = today;
      }
      return;
    }

    const preferred = readLastPropertyId();
    const match = optionsQuery.data.find((p) => p.id === preferred);
    const nextId = match?.id ?? optionsQuery.data[0]!.id;
    setChrome({
      propertyId: nextId,
      from: needsPeriodDefaults ? defaults.from : from,
      to: needsPeriodDefaults ? defaults.to : to,
    });
    prevTodayRef.current = today;
  }, [
    optionsQuery.isSuccess,
    optionsQuery.data,
    propertyId,
    fromParam,
    toParam,
    from,
    to,
    today,
    defaults.from,
    defaults.to,
    setChrome,
  ]);

  const listFilters = useMemo(
    () => ({ propertyId, from, to }),
    [propertyId, from, to],
  );

  const listQuery = useInfiniteQuery({
    queryKey: staffExpensesListQueryKey(listFilters),
    queryFn: ({ pageParam }) =>
      listPropertyExpenses({
        ...listFilters,
        page: pageParam,
        pageSize: PAGE_SIZE_DEFAULT,
      }),
    initialPageParam: INFINITE_INITIAL_PAGE,
    getNextPageParam: getNextPageParamFromPageInfo,
    enabled: Boolean(propertyId) && rangeOk,
  });

  const unitsQuery = useQuery({
    queryKey: [...staffUnitsListQueryKeyPrefix, "expense-picker", propertyId],
    queryFn: () =>
      listUnits(propertyId, { page: 1, pageSize: PAGE_SIZE_MAX }),
    enabled: Boolean(propertyId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePropertyExpense(id),
    onSuccess: () => {
      setDeleteTarget(null);
      setSheetOpen(false);
      setEditTarget(null);
      invalidateExpenseCaches(queryClient);
      handleSuccess(t("expenses:page.deletedToast"));
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data],
  );

  const noProperties = optionsQuery.isSuccess && optionsQuery.data.length === 0;
  const units = unitsQuery.data?.items ?? [];

  const handlePropertyChange = (id: string) => {
    const preset = activePresetId(from, to, today);
    if (preset) {
      const newTz = resolvePropertyTimezone(optionsQuery.data ?? [], id);
      const newToday = opsTodayYmd(newTz);
      const r = rangeForPreset(preset, newToday);
      setChrome({ propertyId: id, from: r.from, to: r.to });
      return;
    }
    setChrome({ propertyId: id });
  };

  const openCreate = () => {
    if (!propertyId) return;
    setEditTarget(null);
    setSheetOpen(true);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-0 p-4 pb-20 md:p-5 md:pb-8">
      <ExpensesFilterBar
        propertyId={propertyId}
        properties={optionsQuery.data ?? []}
        propertiesLoading={optionsQuery.isPending}
        today={today}
        timezone={timezone}
        from={from}
        to={to}
        onPropertyChange={handlePropertyChange}
        onFromChange={(nextFrom) => {
          const nextTo = nextFrom > to ? nextFrom : to;
          setChrome({ from: nextFrom, to: nextTo });
        }}
        onToChange={(nextTo) => {
          const nextFrom = nextTo < from ? nextTo : from;
          setChrome({ from: nextFrom, to: nextTo });
        }}
        onRangeChange={(nextFrom, nextTo) => {
          setChrome({ from: nextFrom, to: nextTo });
        }}
        onAdd={openCreate}
      />

      {noProperties && (
        <p className="pt-8 text-sm text-muted-foreground">
          {t("expenses:page.addPropertyFirst")}
        </p>
      )}

      {!noProperties && !propertyId && (
        <p className="pt-8 text-sm text-muted-foreground">
          {t("expenses:page.selectProperty")}
        </p>
      )}

      {propertyId && !rangeOk && (
        <p className="pt-8 text-sm text-muted-foreground">
          {t("expenses:page.invalidRange")}
        </p>
      )}

      {propertyId && rangeOk && listQuery.isPending && (
        <div className="flex flex-col gap-2 pt-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {propertyId && rangeOk && listQuery.isError && (
        <div className="pt-6">
          <QueryErrorPanel
            message={t("expenses:page.loadError")}
            onRetry={() => {
              void listQuery.refetch();
            }}
            isRetrying={listQuery.isFetching}
          />
        </div>
      )}

      {propertyId && rangeOk && listQuery.isSuccess && items.length === 0 && (
        <Empty className="pt-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WalletIcon />
            </EmptyMedia>
            <EmptyTitle>{t("expenses:page.emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("expenses:page.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <button
              type="button"
              className="text-sm font-medium underline-offset-4 hover:underline"
              onClick={openCreate}
            >
              {t("expenses:page.add")}
            </button>
          </EmptyContent>
        </Empty>
      )}

      {propertyId && rangeOk && items.length > 0 && (
        <div className="overflow-x-auto pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("expenses:table.date")}</TableHead>
                <TableHead>{t("expenses:table.category")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("expenses:table.unit")}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("expenses:table.note")}
                </TableHead>
                <TableHead className="text-right">
                  {t("expenses:table.amount")}
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("expenses:table.who")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setEditTarget(row);
                    setSheetOpen(true);
                  }}
                >
                  <TableCell className="tabular-nums">{row.occurredOn}</TableCell>
                  <TableCell>{formatExpenseCategory(row.category)}</TableCell>
                  <TableCell className="hidden max-w-[8rem] truncate md:table-cell">
                    {row.unitName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-[14rem] truncate md:table-cell">
                    {row.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIdr(row.amountIdr)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {row.createdByAdminUsername ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <InfiniteListFooter
            hasNextPage={Boolean(listQuery.hasNextPage)}
            isFetchingNextPage={listQuery.isFetchingNextPage}
            isFetchNextPageError={listQuery.isFetchNextPageError}
            fetchNextPage={() => {
              void listQuery.fetchNextPage();
            }}
          />
        </div>
      )}

      {sheetOpen && (
        <ExpensesSheet
          key={editTarget?.id ?? "create"}
          open={sheetOpen}
          onOpenChange={(next) => {
            setSheetOpen(next);
            if (!next) setEditTarget(null);
          }}
          propertyId={propertyId}
          defaultOccurredOn={today}
          units={units}
          expense={editTarget}
          onDelete={
            editTarget
              ? () => {
                  setDeleteTarget(editTarget);
                }
              : undefined
          }
        />
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("expenses:delete.title")}
        description={
          deleteTarget
            ? t("expenses:delete.description", {
                amount: formatIdr(deleteTarget.amountIdr),
                category: formatExpenseCategory(deleteTarget.category),
              })
            : ""
        }
        variant="destructive"
        confirmDisabled={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
