/* TEMP: remove when real archive-proof feature ships */
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { ArchiveItem } from "@cabin/api-contract";
import { Button } from "@/components/ui/button";
import { handleError, handleSuccess, uploadArchiveFile } from "@/lib/api";

export function ArchiveSmokeUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastUpload, setLastUpload] = useState<ArchiveItem | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadArchiveFile(file),
    onSuccess: (item) => {
      setLastUpload(item);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      handleSuccess("Archive smoke upload OK");
    },
    onError: (error) => {
      handleError(error);
    },
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border px-3 py-3">
      <p className="text-xs text-muted-foreground">
        TEMP — Garage archive smoke test. Delete this section when proof
        uploads ship for real.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm file:mr-2"
          disabled={uploadMutation.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              uploadMutation.mutate(file);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadMutation.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {uploadMutation.isPending ? "Uploading…" : "Pick image"}
        </Button>
      </div>
      {lastUpload && (
        <div className="flex flex-col gap-2">
          <img
            src={lastUpload.url}
            alt={lastUpload.name}
            className="max-h-48 w-fit max-w-full rounded border border-border object-contain"
          />
          <p className="break-all font-mono text-xs text-muted-foreground">
            {lastUpload.url}
          </p>
          <p className="text-xs text-muted-foreground">
            {(lastUpload.byteSize / 1024).toFixed(1)} KB · {lastUpload.mimeType}
          </p>
        </div>
      )}
    </div>
  );
}
