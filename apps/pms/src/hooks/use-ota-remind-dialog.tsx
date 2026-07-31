import { useCallback, useRef, useState } from "react";
import { OtaRemindDialog } from "@/components/ota/ota-remind-dialog";
import type { OtaChannelSource } from "@/lib/ota-channels";
import type {
  OtaRefreshImportsContext,
  OtaSourceRemindReason,
} from "@/lib/ota-remind";

type SourceRemindState = {
  kind: "source";
  source: OtaChannelSource;
  reason: OtaSourceRemindReason;
};

type RefreshRemindState = {
  kind: "refresh";
  refreshContext: OtaRefreshImportsContext;
};

type OtaRemindState = SourceRemindState | RefreshRemindState;

type UseOtaRemindDialogOptions = {
  /** Fired when staff dismisses the Got it dialog. */
  onDismissed?: () => void;
};

export function useOtaRemindDialog(options?: UseOtaRemindDialogOptions) {
  const [state, setState] = useState<OtaRemindState | null>(null);
  const onDismissedRef = useRef(options?.onDismissed);
  onDismissedRef.current = options?.onDismissed;

  const showRefreshImports = useCallback((ctx: OtaRefreshImportsContext) => {
    setState({ kind: "refresh", refreshContext: ctx });
  }, []);

  const showSourceRemind = useCallback(
    (source: OtaChannelSource, reason: OtaSourceRemindReason) => {
      setState({ kind: "source", source, reason });
    },
    [],
  );

  const dismiss = useCallback(() => {
    setState(null);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      dismiss();
      onDismissedRef.current?.();
    }
  }, [dismiss]);

  const remindDialog =
    state?.kind === "refresh" ? (
      <OtaRemindDialog
        open
        onOpenChange={handleOpenChange}
        reason="refresh-imports"
        refreshContext={state.refreshContext}
      />
    ) : state?.kind === "source" ? (
      <OtaRemindDialog
        open
        onOpenChange={handleOpenChange}
        reason={state.reason}
        source={state.source}
      />
    ) : null;

  return { showRefreshImports, showSourceRemind, remindDialog };
}
