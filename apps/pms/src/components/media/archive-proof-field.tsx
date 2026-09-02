/* anchor: Linear compact attachment field, diverge: image-only mosaic for a table cell */
import { useRef, useState } from "react";
import {
  ARCHIVE_IMAGE_MIME_TYPES,
  UTILITY_READING_PROOF_MAX,
  type ArchiveItem,
} from "@cabin/api-contract";
import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { handleError, uploadArchiveFile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MediaPreviewDialog } from "./media-preview-dialog";
import { ArchiveProofThumb } from "./archive-proof-thumb";

const ACCEPT = [
  ...ARCHIVE_IMAGE_MIME_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
].join(",");

export type ArchiveProofFieldLabels = {
  add: string;
  limit: string;
  counter: string;
  noPhotos: string;
  titleFallback: string;
  previousAria: string;
  nextAria: string;
  closeAria: string;
  removeAria: string;
  nothingToPreview: string;
};

type ArchiveProofFieldProps = {
  value: ArchiveItem[];
  onChange: (next: ArchiveItem[]) => void | Promise<void>;
  readOnly?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  max?: number;
  labels?: ArchiveProofFieldLabels;
  /**
   * `row` = dashed “Add photo” control for forms.
   * `pair` = two squares (first thumb + add) for dense tables.
   * default `compact` = wrap mosaic for timeline cells.
   */
  layout?: "compact" | "row" | "pair";
};

/** Compact multi-photo Garage proof upload + thumbs (utilities table + cash timeline). */
export function ArchiveProofField({
  value,
  onChange,
  readOnly = false,
  onUploadingChange,
  max = UTILITY_READING_PROOF_MAX,
  labels,
  layout = "compact",
}: ArchiveProofFieldProps) {
  const { t } = useTranslation(["reservations", "common"]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [uploadingCount, setUploadingCount] = useState(0);
  const uploadingCountRef = useRef(0);
  const uploading = uploadingCount > 0;

  const L: ArchiveProofFieldLabels = labels ?? {
    add: t("reservations:utilitiesSheet.photos.add"),
    limit: t("reservations:utilitiesSheet.photos.limit", { max }),
    counter: t("reservations:utilitiesSheet.photos.counter"),
    noPhotos: t("reservations:utilitiesSheet.photos.noPhotos"),
    titleFallback: t("reservations:utilitiesSheet.photos.titleFallback"),
    previousAria: t("reservations:utilitiesSheet.photos.previousAria"),
    nextAria: t("reservations:utilitiesSheet.photos.nextAria"),
    closeAria: t("reservations:utilitiesSheet.photos.closeAria"),
    removeAria: t("reservations:utilitiesSheet.photos.removeAria"),
    nothingToPreview: t("reservations:utilitiesSheet.photos.nothingToPreview"),
  };

  function adjustUploading(delta: number) {
    uploadingCountRef.current = Math.max(0, uploadingCountRef.current + delta);
    setUploadingCount(uploadingCountRef.current);
    onUploadingChange?.(uploadingCountRef.current > 0);
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    const remaining = max - value.length;
    if (remaining <= 0) {
      handleError(new Error(L.limit));
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    let next = value;
    for (const file of selected) {
      adjustUploading(1);
      try {
        const item = await uploadArchiveFile(file);
        next = [...next, item];
        await onChange(next);
      } catch (error) {
        handleError(error);
        break;
      } finally {
        adjustUploading(-1);
      }
    }
  }

  const canAdd = !readOnly && !uploading && value.length < max;
  const extraCount = Math.max(0, value.length - 1);
  const first = value[0];

  function openFilePicker() {
    inputRef.current?.click();
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      multiple
      className="sr-only"
      disabled={uploading || readOnly}
      onChange={(event) => {
        void onPick(event.target.files);
        event.target.value = "";
      }}
    />
  );

  const preview = (
    <MediaPreviewDialog
      open={previewOpen}
      onOpenChange={setPreviewOpen}
      items={value}
      index={previewIndex}
      onIndexChange={setPreviewIndex}
      onRequestRemove={
        readOnly
          ? undefined
          : (item) => {
              void (async () => {
                const next = value.filter((m) => m.id !== item.id);
                try {
                  await onChange(next);
                } catch (error) {
                  handleError(error);
                  return;
                }
                const nextIndex = Math.max(0, previewIndex - 1);
                if (value.length === 1) {
                  setPreviewOpen(false);
                } else {
                  setPreviewIndex(nextIndex);
                }
              })();
            }
      }
      labels={{
        titleFallback: L.titleFallback,
        counter: L.counter,
        noItems: L.noPhotos,
        previousAria: L.previousAria,
        nextAria: L.nextAria,
        closeAria: L.closeAria,
        removeAria: L.removeAria,
        nothingToPreview: L.nothingToPreview,
      }}
    />
  );

  if (layout === "pair") {
    const moreOverlay =
      extraCount > 0
        ? t("reservations:utilitiesSheet.photos.moreOverlay", {
            count: extraCount,
          })
        : undefined;
    const moreAria =
      extraCount > 0
        ? t("reservations:utilitiesSheet.photos.moreAria", {
            count: extraCount,
          })
        : undefined;

    return (
      <div className="flex w-[4.875rem] shrink-0 gap-1.5">
        {first ? (
          <ArchiveProofThumb
            item={first}
            overlay={moreOverlay}
            overlayAria={moreAria}
            onPreview={() => {
              setPreviewIndex(0);
              setPreviewOpen(true);
            }}
          />
        ) : (
          <span
            className="size-9 shrink-0 rounded-md border border-border bg-muted"
            aria-hidden
          />
        )}
        {uploading ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <Spinner />
          </span>
        ) : canAdd ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-md border-dashed text-muted-foreground hover:text-foreground"
            aria-label={L.add}
            onClick={openFilePicker}
          >
            <PlusIcon />
          </Button>
        ) : (
          <span className="size-9 shrink-0" aria-hidden />
        )}
        {fileInput}
        {preview}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((item, index) => (
        <ArchiveProofThumb
          key={item.id}
          item={item}
          onPreview={() => {
            setPreviewIndex(index);
            setPreviewOpen(true);
          }}
        />
      ))}
      {uploading && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
          <Spinner />
        </span>
      )}
      {canAdd && layout === "row" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 border-dashed text-muted-foreground hover:text-foreground"
          onClick={openFilePicker}
        >
          <PlusIcon data-icon="inline-start" />
          {L.add}
        </Button>
      )}
      {canAdd && layout === "compact" && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "size-9 shrink-0 rounded-md border-dashed text-muted-foreground hover:text-foreground",
          )}
          aria-label={L.add}
          onClick={openFilePicker}
        >
          <PlusIcon />
        </Button>
      )}
      {fileInput}
      {preview}
    </div>
  );
}
