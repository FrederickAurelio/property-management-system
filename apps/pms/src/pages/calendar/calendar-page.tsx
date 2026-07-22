/* anchor: Linear-dense / Stripe-data calendar, diverge: property×14-day unit grid */
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  StaffCalendarBlock,
  StaffCalendarUnit,
} from "@cabin/api-contract";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { QueryErrorPanel } from "@/components/query-error-panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPropertyCalendar,
  listPropertyOptions,
  staffPropertiesOptionsQueryKey,
  staffPropertyCalendarQueryKey,
} from "@/lib/api";
import { ReservationFormDialog } from "@/pages/reservations/reservation-form-dialog";
import type { ChosenUnit } from "@/pages/reservations/chosen-unit";
import { reservationCalendarStateFromSearch } from "@/pages/reservations/reservation-nav";
import { CalendarBlockSheet } from "./calendar-block-sheet";
import { CalendarGrid } from "./calendar-grid";
import {
  defaultRangeFromToday,
  formatRangeLabel,
  shiftRange,
  todayYmdLocal,
} from "./calendar-layout";
import type { CalendarSelection } from "./calendar-selection";

const LAST_PROPERTY_KEY = "cabin.pms.calendar.propertyId";

type CreateIntent =
  | { mode: "toolbar" }
  | {
      mode: "empty-range";
      selection: CalendarSelection;
      unit: StaffCalendarUnit;
    };

type BlockIntent =
  | { mode: "create"; selection?: CalendarSelection }
  | { mode: "edit"; block: StaffCalendarBlock };

function chosenFromCalendarUnit(
  unit: StaffCalendarUnit,
  propertyId: string,
  propertyName: string,
): ChosenUnit | null {
  if (!unit.unitType) return null;
  return {
    propertyId,
    propertyName,
    unitTypeId: unit.unitType.id,
    unitTypeName: unit.unitType.name,
    unitId: unit.id,
    unitCode: unit.code,
    unitName: unit.name,
  };
}

export function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const today = todayYmdLocal();

  const propertyId = searchParams.get("propertyId") ?? "";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const range = useMemo(() => {
    if (fromParam && toParam && fromParam < toParam) {
      return { from: fromParam, to: toParam };
    }
    return defaultRangeFromToday(today);
  }, [fromParam, toParam, today]);

  const setChrome = useCallback(
    (next: { propertyId?: string; from?: string; to?: string }) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          const pid = next.propertyId ?? p.get("propertyId") ?? "";
          const from = next.from ?? p.get("from") ?? range.from;
          const to = next.to ?? p.get("to") ?? range.to;
          if (pid) p.set("propertyId", pid);
          else p.delete("propertyId");
          p.set("from", from);
          p.set("to", to);
          return p;
        },
        { replace: true },
      );
    },
    [range.from, range.to, setSearchParams],
  );

  const optionsQuery = useQuery({
    queryKey: staffPropertiesOptionsQueryKey(),
    queryFn: listPropertyOptions,
  });

  useEffect(() => {
    if (!optionsQuery.isSuccess || optionsQuery.data.length === 0) return;
    if (propertyId && optionsQuery.data.some((p) => p.id === propertyId)) {
      try {
        sessionStorage.setItem(LAST_PROPERTY_KEY, propertyId);
      } catch {
        /* ignore */
      }
      return;
    }
    let preferred = "";
    try {
      preferred = sessionStorage.getItem(LAST_PROPERTY_KEY) ?? "";
    } catch {
      preferred = "";
    }
    const match = optionsQuery.data.find((p) => p.id === preferred);
    const nextId = match?.id ?? optionsQuery.data[0]!.id;
    setChrome({
      propertyId: nextId,
      from: range.from,
      to: range.to,
    });
  }, [
    optionsQuery.isSuccess,
    optionsQuery.data,
    propertyId,
    range.from,
    range.to,
    setChrome,
  ]);

  const calendarQuery = useQuery({
    queryKey: staffPropertyCalendarQueryKey({
      propertyId,
      from: range.from,
      to: range.to,
    }),
    queryFn: () =>
      getPropertyCalendar({
        propertyId,
        from: range.from,
        to: range.to,
      }),
    enabled: Boolean(propertyId),
  });

  const [createIntent, setCreateIntent] = useState<CreateIntent | null>(null);
  const [blockIntent, setBlockIntent] = useState<BlockIntent | null>(null);

  const propertyName =
    optionsQuery.data?.find((p) => p.id === propertyId)?.name ?? "";

  const onStayClick = useCallback(
    (stay: { id: string }) => {
      void navigate(`/reservations/${stay.id}`, {
        state: reservationCalendarStateFromSearch(location.search),
      });
    },
    [location.search, navigate],
  );

  const onEmptyRange = useCallback(
    (selection: CalendarSelection, unit: StaffCalendarUnit) => {
      setCreateIntent({ mode: "empty-range", selection, unit });
    },
    [],
  );

  const emptyRangeChosen =
    createIntent?.mode === "empty-range"
      ? chosenFromCalendarUnit(
          createIntent.unit,
          propertyId,
          propertyName,
        )
      : null;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Busy and free by unit — same stays as Reservations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-9"
            disabled={!propertyId}
            onClick={() => setBlockIntent({ mode: "create" })}
          >
            New block
          </Button>
          <Button
            type="button"
            className="min-h-11 sm:min-h-9"
            disabled={!propertyId}
            onClick={() => setCreateIntent({ mode: "toolbar" })}
          >
            <PlusIcon data-icon="inline-start" />
            New reservation
          </Button>
        </div>
      </div>

      <div className="sticky top-0 z-30 -mx-4 flex flex-col gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={propertyId || undefined}
          onValueChange={(id) => {
            setChrome({ propertyId: id, from: range.from, to: range.to });
          }}
          disabled={!optionsQuery.isSuccess || optionsQuery.data.length === 0}
        >
          <SelectTrigger className="min-h-11 w-full sm:min-h-9 sm:w-[220px]">
            <SelectValue placeholder="Property" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(optionsQuery.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 sm:size-9"
            aria-label="Previous period"
            onClick={() => {
              const next = shiftRange(range.from, range.to, -1);
              setChrome(next);
            }}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium tabular-nums">
            {formatRangeLabel(range.from, range.to)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 sm:size-9"
            aria-label="Next period"
            onClick={() => {
              const next = shiftRange(range.from, range.to, 1);
              setChrome(next);
            }}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 sm:min-h-9"
            onClick={() => {
              const next = defaultRangeFromToday(today);
              setChrome(next);
            }}
          >
            Today
          </Button>
        </div>
      </div>

      {optionsQuery.isError && (
        <QueryErrorPanel
          message="Could not load properties."
          onRetry={() => void optionsQuery.refetch()}
          isRetrying={optionsQuery.isRefetching}
        />
      )}

      {optionsQuery.isSuccess && optionsQuery.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No properties yet. Create one under Properties first.
        </p>
      )}

      {propertyId && calendarQuery.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {propertyId && calendarQuery.isError && (
        <QueryErrorPanel
          message="Could not load calendar."
          onRetry={() => void calendarQuery.refetch()}
          isRetrying={calendarQuery.isRefetching}
        />
      )}

      {calendarQuery.data && (
        <CalendarGrid
          data={calendarQuery.data}
          todayYmd={today}
          onStayClick={onStayClick}
          onBlockClick={(block) =>
            setBlockIntent({ mode: "edit", block })
          }
          onEmptyRange={onEmptyRange}
        />
      )}

      {createIntent && propertyId && (
        <ReservationFormDialog
          key={
            createIntent.mode === "empty-range"
              ? `empty-${createIntent.selection.unitId}-${createIntent.selection.checkInDate}`
              : "toolbar-create"
          }
          open
          onOpenChange={(next) => {
            if (!next) setCreateIntent(null);
          }}
          intent="create"
          initialPropertyId={propertyId}
          initialPropertyName={propertyName}
          initialChosen={emptyRangeChosen}
          initialCheckInDate={
            createIntent.mode === "empty-range"
              ? createIntent.selection.checkInDate
              : ""
          }
          initialCheckOutDate={
            createIntent.mode === "empty-range"
              ? createIntent.selection.checkOutDate
              : ""
          }
          autoOpenUnitPicker={
            createIntent.mode === "empty-range" && !emptyRangeChosen
          }
          onSaved={() => {
            void calendarQuery.refetch();
          }}
        />
      )}

      {blockIntent && propertyId && (
        <CalendarBlockSheet
          key={
            blockIntent.mode === "edit"
              ? `edit-${blockIntent.block.id}`
              : `create-${blockIntent.selection?.checkInDate ?? "new"}`
          }
          open
          onOpenChange={(next) => {
            if (!next) setBlockIntent(null);
          }}
          propertyId={propertyId}
          propertyName={propertyName}
          calendar={calendarQuery.data}
          block={blockIntent.mode === "edit" ? blockIntent.block : null}
          initialUnitId={
            blockIntent.mode === "create"
              ? blockIntent.selection?.unitId
              : undefined
          }
          initialStartDate={
            blockIntent.mode === "create"
              ? blockIntent.selection?.checkInDate
              : undefined
          }
          initialEndDate={
            blockIntent.mode === "create"
              ? blockIntent.selection?.checkOutDate
              : undefined
          }
        />
      )}
    </div>
  );
}
