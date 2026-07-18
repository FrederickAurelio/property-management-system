/* anchor: Linear explorer chrome, diverge: breadcrumb + search + view toggle */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UnitStatus } from "@cabin/api-contract";
import {
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useExplorerSearchParams } from "@/components/explorer/explorer-params";
import type { ExplorerView } from "@/components/explorer/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  getProperty,
  getUnitType,
  staffPropertyQueryKey,
  staffUnitTypeQueryKey,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  findStaffPropertyName,
  findStaffUnitTypeName,
  parseExplorerNavState,
  type ExplorerNavState,
} from "./explorer-nav-state";

export type ExplorerLayer = "properties" | "types" | "units";

const SEARCH_DEBOUNCE_MS = 300;

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ExplorerView;
  onChange: (view: ExplorerView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex h-8 items-center rounded-lg border border-border bg-background p-0.5"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={value === "list"}
            onClick={() => {
              onChange("list");
            }}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
              value === "list" && "bg-muted text-foreground",
            )}
          >
            <ListIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>List</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={value === "grid"}
            onClick={() => {
              onChange("grid");
            }}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
              value === "grid" && "bg-muted text-foreground",
            )}
          >
            <LayoutGridIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Grid</TooltipContent>
      </Tooltip>
    </div>
  );
}

type ExplorerToolbarProps = {
  layer: ExplorerLayer;
  createLabel: string;
  canManage?: boolean;
  onCreate: () => void;
};

export function ExplorerToolbar({
  layer,
  createLabel,
  canManage = true,
  onCreate,
}: ExplorerToolbarProps) {
  const { propertyId, unitTypeId } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const navState = useMemo(
    () => parseExplorerNavState(location.state),
    [location.state],
  );
  const { q, view, status, patch } = useExplorerSearchParams();
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
    patch({ q: debouncedQ });
  }, [debouncedQ, q, patch]);

  const propertyNameHint = useMemo(() => {
    if (!propertyId || layer === "properties") {
      return undefined;
    }
    return (
      navState.propertyName ??
      findStaffPropertyName(queryClient, propertyId)
    );
  }, [propertyId, layer, navState.propertyName, queryClient]);

  const unitTypeNameHint = useMemo(() => {
    if (!unitTypeId || layer !== "units") {
      return undefined;
    }
    return (
      navState.unitTypeName ??
      findStaffUnitTypeName(queryClient, unitTypeId)
    );
  }, [unitTypeId, layer, navState.unitTypeName, queryClient]);

  const propertyQuery = useQuery({
    queryKey: staffPropertyQueryKey(propertyId ?? ""),
    queryFn: () => getProperty(propertyId!),
    enabled:
      Boolean(propertyId) && layer !== "properties" && !propertyNameHint,
  });

  const unitTypeQuery = useQuery({
    queryKey: staffUnitTypeQueryKey(unitTypeId ?? ""),
    queryFn: () => getUnitType(unitTypeId!),
    enabled: Boolean(unitTypeId) && layer === "units" && !unitTypeNameHint,
  });

  const propertyName =
    propertyQuery.data?.name ?? propertyNameHint ?? "…";
  const unitTypeName =
    unitTypeQuery.data?.name ?? unitTypeNameHint ?? "…";

  const propertyCrumbState: ExplorerNavState = {
    propertyName:
      propertyName !== "…" ? propertyName : navState.propertyName,
  };

  return (
    <div className="sticky top-12 z-20 flex flex-col gap-3 border-b border-border bg-background pb-3">
      <Breadcrumb>
        <BreadcrumbList className="gap-2 text-base [&_[data-slot=breadcrumb-separator]>svg]:size-4">
          <BreadcrumbItem>
            {layer === "properties" ? (
              <BreadcrumbPage>Properties</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link to="/properties">Properties</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {propertyId && layer !== "properties" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {layer === "types" ? (
                  <BreadcrumbPage className="max-w-[12rem] truncate sm:max-w-xs">
                    {propertyName}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={`/properties/${propertyId}`}
                      state={propertyCrumbState}
                      className="max-w-[12rem] truncate sm:max-w-xs"
                    >
                      {propertyName}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </>
          )}
          {unitTypeId && layer === "units" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-[12rem] truncate sm:max-w-xs">
                  {unitTypeName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={qDraft}
            onChange={(event) => {
              setQDraft(event.target.value);
            }}
            placeholder={
              layer === "properties"
                ? "Search properties…"
                : layer === "types"
                  ? "Search types…"
                  : "Search units…"
            }
            aria-label="Search"
          />
        </InputGroup>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {layer === "units" && (
            <Select
              value={status}
              onValueChange={(value) => {
                patch({ status: value });
              }}
            >
              <SelectTrigger className="w-[9.5rem]" size="sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value={UnitStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={UnitStatus.INACTIVE}>Inactive</SelectItem>
                  <SelectItem value={UnitStatus.MAINTENANCE}>
                    Maintenance
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          <ViewModeToggle
            value={view}
            onChange={(next) => {
              patch({ view: next });
            }}
          />

          {canManage && (
            <Button type="button" size="sm" onClick={onCreate}>
              <PlusIcon data-icon="inline-start" />
              {createLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
