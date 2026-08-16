/* anchor: Linear-dense / Stripe-data ops list, diverge: time-range toggles + compact log filters */
import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
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
import { REQUEST_LOG_RANGES, type RequestLogRange } from "./request-logs-range";

const SEARCH_DEBOUNCE_MS = 300;

type RequestLogsFiltersBarProps = {
  range: RequestLogRange;
  q: string;
  app: string;
  actor: string;
  requestId: string;
  errorsOnly: boolean;
  onPatch: (patch: Record<string, string | null>) => void;
};

export function RequestLogsFiltersBar({
  range,
  q,
  app,
  actor,
  requestId,
  errorsOnly,
  onPatch,
}: RequestLogsFiltersBarProps) {
  const { t } = useTranslation(["request-logs", "common"]);
  const [, setSearchParams] = useSearchParams();
  const [qDraft, setQDraft] = useState(q);
  const [actorDraft, setActorDraft] = useState(actor);
  const [requestIdDraft, setRequestIdDraft] = useState(requestId);
  const [prevQ, setPrevQ] = useState(q);
  const [prevActor, setPrevActor] = useState(actor);
  const [prevRequestId, setPrevRequestId] = useState(requestId);
  if (q !== prevQ) {
    setPrevQ(q);
    setQDraft(q);
  }
  if (actor !== prevActor) {
    setPrevActor(actor);
    setActorDraft(actor);
  }
  if (requestId !== prevRequestId) {
    setPrevRequestId(requestId);
    setRequestIdDraft(requestId);
  }
  const debouncedQ = useDebouncedValue(qDraft, SEARCH_DEBOUNCE_MS);
  const debouncedActor = useDebouncedValue(actorDraft, SEARCH_DEBOUNCE_MS);
  const debouncedRequestId = useDebouncedValue(
    requestIdDraft,
    SEARCH_DEBOUNCE_MS,
  );

  useEffect(() => {
    if (
      debouncedQ === q &&
      debouncedActor === actor &&
      debouncedRequestId === requestId
    ) {
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
        if (debouncedActor) {
          next.set("actor", debouncedActor);
        } else {
          next.delete("actor");
        }
        if (debouncedRequestId) {
          next.set("requestId", debouncedRequestId);
        } else {
          next.delete("requestId");
        }
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [
    actor,
    debouncedActor,
    debouncedQ,
    debouncedRequestId,
    q,
    requestId,
    setSearchParams,
  ]);

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 overflow-x-auto px-1">
        <ToggleGroup
          type="single"
          variant="default"
          size="sm"
          value={range}
          aria-label={t("request-logs:filters.rangeAria")}
          onValueChange={(value) => {
            if (!value) {
              return;
            }
            onPatch({
              range: value,
              page: null,
            });
          }}
        >
          {REQUEST_LOG_RANGES.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {t(`request-logs:filters.range_${item}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

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
            placeholder={t("request-logs:filters.searchPlaceholder")}
            aria-label={t("request-logs:filters.searchAria")}
          />
        </InputGroup>

        <Select
          value={app || "all"}
          onValueChange={(value) => {
            onPatch({
              app: value === "all" ? null : value,
              page: null,
            });
          }}
        >
          <SelectTrigger
            className="w-full sm:w-36"
            aria-label={t("request-logs:filters.appAria")}
          >
            <SelectValue placeholder={t("request-logs:filters.appAll")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">
                {t("request-logs:filters.appAll")}
              </SelectItem>
              <SelectItem value="pms">
                {t("request-logs:filters.appPms")}
              </SelectItem>
              <SelectItem value="web">
                {t("request-logs:filters.appWeb")}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <InputGroup className="w-full sm:max-w-36">
          <InputGroupInput
            value={actorDraft}
            onChange={(e) => {
              setActorDraft(e.target.value);
            }}
            placeholder={t("request-logs:filters.actorPlaceholder")}
            aria-label={t("request-logs:filters.actorAria")}
          />
        </InputGroup>

        <InputGroup className="w-full sm:max-w-48">
          <InputGroupInput
            value={requestIdDraft}
            onChange={(e) => {
              setRequestIdDraft(e.target.value);
            }}
            placeholder={t("request-logs:filters.requestIdPlaceholder")}
            aria-label={t("request-logs:filters.requestIdAria")}
            className="font-mono text-xs"
          />
        </InputGroup>

        <div className="flex h-8 items-center gap-2">
          <Checkbox
            id="request-logs-errors-only"
            checked={errorsOnly}
            onCheckedChange={(checked) => {
              onPatch({
                errorsOnly: checked === true ? "1" : null,
                page: null,
              });
            }}
          />
          <Label htmlFor="request-logs-errors-only" className="text-sm">
            {t("request-logs:filters.errorsOnly")}
          </Label>
        </div>
      </div>
    </div>
  );
}
