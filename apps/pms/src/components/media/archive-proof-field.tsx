/* anchor: Linear compact attachment field, diverge: image-only mosaic for a table cell */
import { useRef, useState } from "react";
import {
  ARCHIVE_IMAGE_MIME_TYPES,
  UTILITY_READING_PROOF_MAX,
  type ArchiveItem,
} from "@cabin/api-contract";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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

type ArchiveProofFieldProps = {
  value: ArchiveItem[];
  onChange: (next: ArchiveItem[]) => void;
  readOnly?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
};

/** Compact multi-photo meteran upload + small-thumb gallery for the utilities sheet. */
export function ArchiveProofField({
  value,
  onChange,
  readOnly = false,
  onUploadingChange,
}: ArchiveProofFieldProps) {
  const { t } = useTranslation(["reservations", "common"]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [uploadingCount, setUploadingCount] = useState(0);
  const uploading = uploadingCount > 0;

  function adjustUploading(delta: number) {
    const next = Math.max(0, uploadingCount + delta);
    setUploadingCount(next);
    onUploadingChange?.(next > 0);
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    const remaining = UTILITY_READING_PROOF_MAX - value.length;
    if (remaining <= 0) {
      handleError(
        new Error(
          t("reservations:utilitiesSheet.photos.limit", {
            max: UTILITY_READING_PROOF_MAX,
          }),
        ),
      );
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    let next = value;
    for (const file of selected) {
      adjustUploading(1);
      try {
        const item = await uploadArchiveFile(file);
        next = [...next, item];
        onChange(next);
      } catch (error) {
        handleError(error);
      } finally {
        adjustUploading(-1);
      }
    }
  }

  const canAdd =
    !readOnly && !uploading && value.length < UTILITY_READING_PROOF_MAX;

  return (
    <div className="flex items-center gap-1.5">
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
          <Loader2Icon className="size-4 animate-spin" />
        </span>
      )}
      {canAdd && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "size-9 shrink-0 rounded-md border-dashed text-muted-foreground hover:text-foreground",
          )}
          aria-label={t("reservations:utilitiesSheet.photos.add")}
          onClick={() => inputRef.current?.click()}
        >
          <PlusIcon className="size-4" />
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        disabled={uploading}
        onChange={(event) => {
          void onPick(event.target.files);
          event.target.value = "";
        }}
      />

      <MediaPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={value}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        onRequestRemove={(item) => {
          onChange(value.filter((m) => m.id !== item.id));
          const nextIndex = Math.max(0, previewIndex - 1);
          if (value.length === 1) {
            setPreviewOpen(false);
          } else {
            setPreviewIndex(nextIndex);
          }
        }}
        labels={{
          titleFallback: t("reservations:utilitiesSheet.photos.titleFallback"),
          counter: t("reservations:utilitiesSheet.photos.counter"),
          noItems: t("reservations:utilitiesSheet.photos.noPhotos"),
          previousAria: t("reservations:utilitiesSheet.photos.previousAria"),
          nextAria: t("reservations:utilitiesSheet.photos.nextAria"),
          closeAria: t("reservations:utilitiesSheet.photos.closeAria"),
          removeAria: t("reservations:utilitiesSheet.photos.removeAria"),
          nothingToPreview: t(
            "reservations:utilitiesSheet.photos.nothingToPreview",
          ),
        }}
      />
    </div>
  );
}
