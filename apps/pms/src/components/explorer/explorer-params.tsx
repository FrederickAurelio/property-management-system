/* anchor: Linear explorer chrome, diverge: shared q/status/view across layers */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ExplorerView } from "./types";

const VIEW_STORAGE_KEY = "cabin.pms.explorer.view";

function readStoredView(fallback: ExplorerView): ExplorerView {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw === "grid" || raw === "list") {
      return raw;
    }
  } catch {
    // ignore
  }
  return fallback;
}

function writeStoredView(view: ExplorerView): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // ignore
  }
}

type ExplorerParams = {
  q: string;
  view: ExplorerView;
  /** Domain-specific filter value; `"all"` clears the URL param. */
  status: string;
  patch: (next: { q?: string; view?: ExplorerView; status?: string }) => void;
};

const ExplorerParamsContext = createContext<ExplorerParams | null>(null);

export function ExplorerParamsProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const defaultView: ExplorerView = isMobile ? "list" : "grid";

  const [view, setViewState] = useState<ExplorerView>(() =>
    readStoredView(defaultView),
  );

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";

  const setView = useCallback((next: ExplorerView) => {
    setViewState(next);
    writeStoredView(next);
  }, []);

  const patch = useCallback(
    (next: { q?: string; view?: ExplorerView; status?: string }) => {
      if (next.view !== undefined) {
        setView(next.view);
      }

      if (next.q === undefined && next.status === undefined) {
        return;
      }

      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next.q !== undefined) {
            if (next.q) {
              params.set("q", next.q);
            } else {
              params.delete("q");
            }
          }
          if (next.status !== undefined) {
            if (next.status === "all") {
              params.delete("status");
            } else {
              params.set("status", next.status);
            }
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams, setView],
  );

  const value = useMemo(
    () => ({ q, view, status, patch }),
    [q, view, status, patch],
  );

  return (
    <ExplorerParamsContext.Provider value={value}>
      {children}
    </ExplorerParamsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useExplorerSearchParams(): ExplorerParams {
  const ctx = useContext(ExplorerParamsContext);
  if (!ctx) {
    throw new Error(
      "useExplorerSearchParams must be used within ExplorerParamsProvider",
    );
  }
  return ctx;
}
