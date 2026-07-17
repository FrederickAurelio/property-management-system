/* anchor: Linear explorer chrome, diverge: breadcrumb + search + view toggle */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
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
import { cn } from "@/lib/utils";
import type { UnitStatus } from "./inventory-types";
// MOCK — breadcrumb names from local store; replace with useQuery detail lookups.
import { useInventory } from "./mock-inventory";

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
  onCreate: () => void;
};

export function ExplorerToolbar({
  layer,
  createLabel,
  onCreate,
}: ExplorerToolbarProps) {
  const { propertyId, unitTypeId } = useParams();
  // MOCK — toolbar reads in-memory inventory for breadcrumb labels.
  const inventory = useInventory();
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

  // MOCK — breadcrumb labels from in-memory inventory; API detail queries later.
  const property = useMemo(
    () => inventory.properties.find((p) => p.id === propertyId),
    [inventory.properties, propertyId],
  );
  const unitType = useMemo(
    () => inventory.unitTypes.find((t) => t.id === unitTypeId),
    [inventory.unitTypes, unitTypeId],
  );

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
          {property && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {layer === "types" ? (
                  <BreadcrumbPage className="max-w-[12rem] truncate sm:max-w-xs">
                    {property.name}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={`/properties/${property.id}`}
                      className="max-w-[12rem] truncate sm:max-w-xs"
                    >
                      {property.name}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </>
          )}
          {unitType && layer === "units" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-[12rem] truncate sm:max-w-xs">
                  {unitType.name}
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
                patch({ status: value as UnitStatus | "all" });
              }}
            >
              <SelectTrigger className="w-[9.5rem]" size="sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
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

          <Button type="button" size="sm" onClick={onCreate}>
            <PlusIcon data-icon="inline-start" />
            {createLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
