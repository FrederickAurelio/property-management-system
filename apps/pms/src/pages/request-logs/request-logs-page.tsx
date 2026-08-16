/* anchor: Linear-dense / Stripe-data ops list, diverge: numbered pages over Loki window */
import { useCallback, useMemo, useState, type MouseEvent } from "react";
import {
  ApiError,
  ApiErrorCode,
  PAGE_MIN,
  PAGE_SIZE_DEFAULT,
  type StaffRequestLogItem,
} from "@cabin/api-contract";
import { useQuery } from "@tanstack/react-query";
import { ScrollTextIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { QueryRetryButton } from "@/components/query-retry-button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  listRequestLogs,
  staffRequestLogsQueryKey,
  type StaffRequestLogsListFilters,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { RequestLogsDetailSheet } from "./request-logs-detail-sheet";
import { RequestLogsFiltersBar } from "./request-logs-filters-bar";
import { parseRequestLogRange, rangeToFromTo } from "./request-logs-range";

function parsePage(raw: string | null): number {
  if (!raw) {
    return PAGE_MIN;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < PAGE_MIN) {
    return PAGE_MIN;
  }
  return n;
}

function statusTone(status: number): "outline" | "secondary" | "destructive" {
  if (status >= 500) {
    return "destructive";
  }
  if (status >= 400) {
    return "secondary";
  }
  return "outline";
}

function visiblePages(
  page: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) {
    items.push("ellipsis");
  }
  for (let i = start; i <= end; i += 1) {
    items.push(i);
  }
  if (end < totalPages - 1) {
    items.push("ellipsis");
  }
  items.push(totalPages);
  return items;
}

function RequestLogsPageSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-8 w-full max-w-xl" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export function RequestLogsPage() {
  const { t, i18n } = useTranslation(["request-logs", "common"]);
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<StaffRequestLogItem | null>(null);

  const range = parseRequestLogRange(searchParams.get("range"));
  const page = parsePage(searchParams.get("page"));
  const q = searchParams.get("q") ?? "";
  const appRaw = searchParams.get("app");
  const appFilter = appRaw === "pms" || appRaw === "web" ? appRaw : undefined;
  const app = appFilter ?? "";
  const actor = searchParams.get("actor") ?? "";
  const requestId = searchParams.get("requestId") ?? "";
  const errorsOnly = searchParams.get("errorsOnly") === "1";

  const listFilters = useMemo((): StaffRequestLogsListFilters => {
    return {
      page,
      pageSize: PAGE_SIZE_DEFAULT,
      range,
      ...(q ? { q } : {}),
      ...(appFilter ? { app: appFilter } : {}),
      ...(actor ? { actor } : {}),
      ...(requestId ? { requestId } : {}),
      ...(errorsOnly ? { errorsOnly: true } : {}),
    };
  }, [actor, appFilter, errorsOnly, page, q, range, requestId]);

  const listQuery = useQuery({
    queryKey: staffRequestLogsQueryKey(listFilters),
    queryFn: () => {
      const { from, to } = rangeToFromTo(range);
      return listRequestLogs({
        page: listFilters.page,
        pageSize: listFilters.pageSize,
        from,
        to,
        ...(listFilters.q ? { q: listFilters.q } : {}),
        ...(listFilters.app ? { app: listFilters.app } : {}),
        ...(listFilters.actor ? { actor: listFilters.actor } : {}),
        ...(listFilters.requestId ? { requestId: listFilters.requestId } : {}),
        ...(listFilters.errorsOnly ? { errorsOnly: true } : {}),
      });
    },
    refetchInterval: (query) => (query.state.error ? false : 15_000),
    refetchIntervalInBackground: false,
  });

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === "") {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      patchParams({
        page: nextPage <= PAGE_MIN ? null : String(nextPage),
      });
    },
    [patchParams],
  );

  const pageHref = useCallback(
    (nextPage: number) => {
      const next = new URLSearchParams(searchParams);
      if (nextPage <= PAGE_MIN) {
        next.delete("page");
      } else {
        next.set("page", String(nextPage));
      }
      const qs = next.toString();
      return qs ? `/request-logs?${qs}` : "/request-logs";
    },
    [searchParams],
  );

  const onPageClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, nextPage: number) => {
      event.preventDefault();
      setPage(nextPage);
    },
    [setPage],
  );

  const formatTime = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleString(i18n.language, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [i18n.language],
  );

  const logsUnavailable =
    listQuery.error instanceof ApiError &&
    listQuery.error.code === ApiErrorCode.LOGS_UNAVAILABLE;

  const items = listQuery.data?.items ?? [];
  const pageInfo = listQuery.data?.pageInfo;
  const truncated = listQuery.data?.truncated === true;
  const total = pageInfo?.total ?? 0;
  const emptyWindow = Boolean(listQuery.data) && items.length === 0 && total === 0;
  const emptyPage = Boolean(listQuery.data) && items.length === 0 && total > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <RequestLogsFiltersBar
        range={range}
        q={q}
        app={app}
        actor={actor}
        requestId={requestId}
        errorsOnly={errorsOnly}
        onPatch={patchParams}
      />

      {listQuery.isPending && <RequestLogsPageSkeleton />}

      {listQuery.isError && logsUnavailable && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollTextIcon />
            </EmptyMedia>
            <EmptyTitle>{t("request-logs:empty.unavailableTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("request-logs:empty.unavailableDescription")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <QueryRetryButton
              onRetry={() => {
                void listQuery.refetch();
              }}
              isRetrying={listQuery.isFetching}
            />
          </EmptyContent>
        </Empty>
      )}

      {listQuery.isError && !logsUnavailable && (
        <QueryErrorPanel
          message={
            listQuery.error instanceof ApiError && listQuery.error.message
              ? listQuery.error.message
              : t("request-logs:loadError")
          }
          onRetry={() => {
            void listQuery.refetch();
          }}
          isRetrying={listQuery.isFetching}
        />
      )}

      {truncated && (
        <p className="text-sm text-muted-foreground">
          {t("request-logs:truncated")}
        </p>
      )}

      {emptyWindow && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollTextIcon />
            </EmptyMedia>
            <EmptyTitle>{t("request-logs:empty.noneTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("request-logs:empty.noneDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {emptyPage && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollTextIcon />
            </EmptyMedia>
            <EmptyTitle>{t("request-logs:empty.pageTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("request-logs:empty.pageDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {(items.length > 0 || emptyPage) && (
        <>
          {items.length > 0 &&
            (isMobile ? (
            <ul className="flex flex-col gap-2">
              {items.map((row) => (
                <li key={`${row.requestId}-${row.time}`}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-muted/40"
                    onClick={() => {
                      setSelected(row);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatTime(row.time)}
                      </span>
                      <Badge variant={statusTone(row.status)}>
                        {row.status}
                      </Badge>
                    </div>
                    <p className="truncate font-medium">
                      {row.method} {row.path}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.actor} · {row.app}
                      {row.errorMessage ? ` · ${row.errorMessage}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("request-logs:table.time")}</TableHead>
                  <TableHead>{t("request-logs:table.user")}</TableHead>
                  <TableHead>{t("request-logs:table.app")}</TableHead>
                  <TableHead>{t("request-logs:table.method")}</TableHead>
                  <TableHead>{t("request-logs:table.path")}</TableHead>
                  <TableHead>{t("request-logs:table.status")}</TableHead>
                  <TableHead>{t("request-logs:table.error")}</TableHead>
                  <TableHead>{t("request-logs:table.requestId")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow
                    key={`${row.requestId}-${row.time}`}
                    className={cn("relative cursor-pointer hover:bg-muted/40")}
                    onClick={() => {
                      setSelected(row);
                    }}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatTime(row.time)}
                    </TableCell>
                    <TableCell className="max-w-28 truncate">
                      {row.actor}
                    </TableCell>
                    <TableCell>{row.app}</TableCell>
                    <TableCell className="font-medium">{row.method}</TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs">
                      {row.path}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusTone(row.status)}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {row.errorMessage ?? row.errorCode ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-36 truncate font-mono text-xs text-muted-foreground">
                      {row.requestId}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}

          {pageInfo && pageInfo.totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    text={t("request-logs:pagination.previous")}
                    href={pageHref(pageInfo.page - 1)}
                    aria-disabled={pageInfo.page <= 1}
                    tabIndex={pageInfo.page <= 1 ? -1 : undefined}
                    className={
                      pageInfo.page <= 1
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                    onClick={(event) => {
                      if (pageInfo.page <= 1) {
                        event.preventDefault();
                        return;
                      }
                      onPageClick(event, pageInfo.page - 1);
                    }}
                  />
                </PaginationItem>
                {visiblePages(pageInfo.page, pageInfo.totalPages).map(
                  (item, index) =>
                    item === "ellipsis" ? (
                      <PaginationItem key={`e-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          href={pageHref(item)}
                          isActive={item === pageInfo.page}
                          onClick={(event) => {
                            onPageClick(event, item);
                          }}
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                )}
                <PaginationItem>
                  <PaginationNext
                    text={t("request-logs:pagination.next")}
                    href={pageHref(pageInfo.page + 1)}
                    aria-disabled={pageInfo.page >= pageInfo.totalPages}
                    tabIndex={
                      pageInfo.page >= pageInfo.totalPages ? -1 : undefined
                    }
                    className={
                      pageInfo.page >= pageInfo.totalPages
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                    onClick={(event) => {
                      if (pageInfo.page >= pageInfo.totalPages) {
                        event.preventDefault();
                        return;
                      }
                      onPageClick(event, pageInfo.page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      <RequestLogsDetailSheet
        row={selected}
        formatTime={formatTime}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
      />
    </div>
  );
}
