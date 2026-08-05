/* anchor: Linear issue list + ExplorerToolbar, diverge: board tabs then compact filter row */
import { useEffect, useState } from "react";
import {
  ReservationListSort,
  ReservationSource,
  ReservationStatus,
  StayBillingPeriod,
} from "@cabin/api-contract";
import { SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ReservationBoard } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ReservationDateRangeFilter } from "./reservation-date-range-filter";
import { reservationBoards } from "./reservation-boards";
import {
  formatReservationSource,
  formatReservationStatus,
} from "./reservation-format";

const SEARCH_DEBOUNCE_MS = 300;

export type ReservationPropertyOption = {
  id: string;
  name: string;
};

type ReservationFiltersBarProps = {
  board: ReservationBoard;
  propertyId: string;
  statusFilter: string;
  sourceFilter: string;
  /** `all` or StayBillingPeriod value. */
  billingPeriodFilter: string;
  sort: ReservationListSort;
  /** False when the board owns status (Nest overwrites any client status). */
  showStatusFilter: boolean;
  /** Stay-touch from/to — lookup boards only. */
  showDateRangeFilter: boolean;
  from: string;
  to: string;
  /** URL `q` — bar owns draft typing; syncs debounced value back. */
  q: string;
  propertyOptions: ReservationPropertyOption[];
  onPatch: (patch: Record<string, string | null>) => void;
};

export function ReservationFiltersBar({
  board,
  propertyId,
  statusFilter,
  sourceFilter,
  billingPeriodFilter,
  sort,
  showStatusFilter,
  showDateRangeFilter,
  from,
  to,
  q,
  propertyOptions,
  onPatch,
}: ReservationFiltersBarProps) {
  const { t } = useTranslation(["reservations", "common"]);
  const [, setSearchParams] = useSearchParams();
  const [qDraft, setQDraft] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setQDraft(q);
  }
  const debouncedQ = useDebouncedValue(qDraft, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (debouncedQ === q) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedQ) {
          next.set("q", debouncedQ);
        } else {
          next.delete("q");
        }
        return next;
      },
      { replace: true },
    );
  }, [debouncedQ, q, setSearchParams]);

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 overflow-x-auto px-1">
        <ToggleGroup
          type="single"
          variant="default"
          size="sm"
          value={board}
          onValueChange={(value) => {
            if (!value) {
              return;
            }
            onPatch({ board: value as ReservationBoard });
          }}
          className="flex w-max flex-nowrap justify-start gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5 dark:bg-muted/40"
        >
          {reservationBoards().map((b) => (
            <ToggleGroupItem
              key={b.id}
              value={b.id}
              className={cn(
                "shrink-0 border-0 bg-transparent text-muted-foreground shadow-none",
                "hover:bg-background/70 hover:text-foreground",
                "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
                "dark:data-[state=on]:bg-background dark:data-[state=on]:text-foreground",
              )}
            >
              {b.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Same DNA as ExplorerToolbar: search + compact controls, never full-bleed selects */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={qDraft}
            onChange={(e) => {
              setQDraft(e.target.value);
            }}
            placeholder={t("reservations:filtersBar.searchPlaceholder")}
            aria-label={t("reservations:filtersBar.searchAria")}
          />
        </InputGroup>

        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:ml-auto sm:overflow-visible sm:px-0 sm:pb-0">
          <Select
            value={propertyId || undefined}
            onValueChange={(value) => {
              if (value) {
                onPatch({ propertyId: value });
              }
            }}
            disabled={propertyOptions.length === 0}
          >
            <SelectTrigger
              size="sm"
              className="w-[10.5rem] shrink-0"
              aria-label={t("reservations:filtersBar.propertyAria")}
            >
              <SelectValue
                placeholder={t("reservations:filtersBar.propertyPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {propertyOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={billingPeriodFilter}
            onValueChange={(value) => {
              onPatch({ billingPeriod: value === "all" ? null : value });
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-[8.75rem] shrink-0"
              aria-label={t("reservations:filtersBar.periodAria")}
            >
              <SelectValue
                placeholder={t("reservations:filtersBar.periodAria")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {t("reservations:filtersBar.anyPeriod")}
                </SelectItem>
                <SelectItem value={StayBillingPeriod.DAILY}>
                  {t("reservations:filtersBar.periods.daily")}
                </SelectItem>
                <SelectItem value={StayBillingPeriod.MONTHLY}>
                  {t("reservations:filtersBar.periods.monthly")}
                </SelectItem>
                <SelectItem value={StayBillingPeriod.YEARLY}>
                  {t("reservations:filtersBar.periods.yearly")}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {showDateRangeFilter && (
            <ReservationDateRangeFilter
              from={from}
              to={to}
              onPatch={onPatch}
            />
          )}
          {showStatusFilter && (
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                onPatch({ status: value === "all" ? null : value });
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-[8.75rem] shrink-0"
                aria-label={t("reservations:filtersBar.statusAria")}
              >
                <SelectValue
                  placeholder={t("reservations:filtersBar.statusAria")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    {t("reservations:filtersBar.anyStatus")}
                  </SelectItem>
                  {Object.values(ReservationStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatReservationStatus(s)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <Select
            value={sourceFilter}
            onValueChange={(value) => {
              onPatch({ source: value === "all" ? null : value });
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-[8.75rem] shrink-0"
              aria-label={t("reservations:filtersBar.sourceAria")}
            >
              <SelectValue
                placeholder={t("reservations:filtersBar.sourceAria")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {t("reservations:filtersBar.anySource")}
                </SelectItem>
                {Object.values(ReservationSource).map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatReservationSource(s)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(value) => {
              // Balance due Stay date must stay as `checkIn` in the URL —
              // missing sort is parsed as open amount on that board.
              onPatch({
                sort:
                  value === ReservationListSort.checkIn &&
                  board !== "balance-due"
                    ? null
                    : value,
              });
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-[9.5rem] shrink-0"
              aria-label={t("reservations:filtersBar.sortAria")}
            >
              <SelectValue placeholder={t("reservations:filtersBar.sortAria")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ReservationListSort.checkIn}>
                  {t("reservations:filtersBar.sortStayDate")}
                </SelectItem>
                <SelectItem value={ReservationListSort.createdAt}>
                  {t("reservations:filtersBar.sortCreated")}
                </SelectItem>
                {board === "balance-due" && (
                  <SelectItem value={ReservationListSort.openAmount}>
                    {t("reservations:filtersBar.sortOpenAmount")}
                  </SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
