/* anchor: Linear issue list + ExplorerToolbar, diverge: board tabs then compact filter row */
import { useEffect, useState } from "react";
import {
  ReservationSource,
  ReservationStatus,
} from "@cabin/api-contract";
import { SearchIcon } from "lucide-react";
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
import { RESERVATION_BOARDS } from "./reservation-boards";
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
  /** False when the board owns status (Nest overwrites any client status). */
  showStatusFilter: boolean;
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
  showStatusFilter,
  q,
  propertyOptions,
  onPatch,
}: ReservationFiltersBarProps) {
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
          {RESERVATION_BOARDS.map((b) => (
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
            placeholder="Search guest, unit, phone…"
            aria-label="Search reservations"
          />
        </InputGroup>

        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:ml-auto sm:overflow-visible sm:px-0 sm:pb-0">
          <Select
            value={propertyId || "all"}
            onValueChange={(value) => {
              onPatch({ propertyId: value === "all" ? null : value });
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-[10.5rem] shrink-0"
              aria-label="Property"
            >
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All properties</SelectItem>
                {propertyOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
                aria-label="Status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Any status</SelectItem>
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
              aria-label="Source"
            >
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Any source</SelectItem>
                {Object.values(ReservationSource).map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatReservationSource(s)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
