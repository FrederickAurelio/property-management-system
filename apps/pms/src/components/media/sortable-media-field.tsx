/* anchor: Notion media grid / Linear attachments, diverge: dnd-kit sort + Cloudinary upload */
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MEDIA_GALLERY_MAX_ITEMS,
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_IMAGE_MIME_TYPES,
  MEDIA_VIDEO_MAX_BYTES,
  MEDIA_VIDEO_MIME_TYPES,
  MediaKind,
} from "@cabin/api-contract";
import {
  GripVerticalIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";
import { handleError, uploadMediaFile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MediaPreviewDialog } from "./media-preview-dialog";
import { MediaThumb } from "./media-thumb";
import { mediaKindFromMime, revokeIfBlobUrl, type MediaItem } from "./types";

const ACCEPT = [
  ...MEDIA_IMAGE_MIME_TYPES,
  ...MEDIA_VIDEO_MIME_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp4",
  ".webm",
].join(",");

const COVER_ACCEPT = [
  ...MEDIA_IMAGE_MIME_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
].join(",");

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assertFileAllowed(file: File, imagesOnly = false): MediaKind | null {
  const kind = mediaKindFromMime(file.type);
  if (!kind) {
    handleError(
      new Error(
        i18n.t("inventory:media.errors.unsupportedType", {
          name: file.name || file.type,
          extra: imagesOnly
            ? ""
            : i18n.t("inventory:media.errors.unsupportedTypeVideoSuffix"),
        }),
      ),
    );
    return null;
  }
  if (imagesOnly && kind !== MediaKind.IMAGE) {
    handleError(new Error(i18n.t("inventory:media.errors.coverMustBeImage")));
    return null;
  }
  const max =
    kind === MediaKind.IMAGE ? MEDIA_IMAGE_MAX_BYTES : MEDIA_VIDEO_MAX_BYTES;
  if (file.size > max) {
    handleError(
      new Error(
        i18n.t("inventory:media.errors.fileTooLarge", {
          name: file.name || i18n.t("inventory:media.errors.defaultFileName"),
          size: formatBytes(file.size),
          max: formatBytes(max),
        }),
      ),
    );
    return null;
  }
  return kind;
}

type SortableTileProps = {
  item: MediaItem;
  onPreview: () => void;
  onRemove: () => void;
  readOnly?: boolean;
};

function SortableTile({
  item,
  onPreview,
  onRemove,
  readOnly = false,
}: SortableTileProps) {
  const { t } = useTranslation(["inventory", "common"]);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "z-20 opacity-80")}
    >
      <MediaThumb
        item={item}
        onPreview={onPreview}
        overlay={
          readOnly ? undefined : (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                className="cursor-grab touch-none active:cursor-grabbing"
                aria-label={t("inventory:media.dragToReorder")}
                {...attributes}
                {...listeners}
              >
                <GripVerticalIcon />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                aria-label={t("inventory:media.removeItem", {
                  name: item.name,
                })}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
              >
                <Trash2Icon />
              </Button>
            </>
          )
        }
      />
      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        {item.name}
      </p>
    </div>
  );
}

type SortableMediaFieldProps = {
  value: MediaItem[];
  onChange: (next: MediaItem[]) => void;
  readOnly?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
};

export function SortableMediaField({
  value,
  onChange,
  readOnly = false,
  onUploadingChange,
}: SortableMediaFieldProps) {
  const { t } = useTranslation(["inventory", "common"]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [uploadingCount, setUploadingCount] = useState(0);
  const ids = useMemo(() => value.map((item) => item.id), [value]);
  const uploading = uploadingCount > 0;

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = value.findIndex((item) => item.id === active.id);
    const newIndex = value.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    onChange(arrayMove(value, oldIndex, newIndex));
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    let next = value;
    const remaining = MEDIA_GALLERY_MAX_ITEMS - next.length;
    if (remaining <= 0) {
      handleError(
        new Error(
          t("inventory:media.errors.galleryLimit", {
            max: MEDIA_GALLERY_MAX_ITEMS,
          }),
        ),
      );
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      handleError(
        new Error(
          t("inventory:media.errors.galleryRemaining", {
            count: remaining,
            max: MEDIA_GALLERY_MAX_ITEMS,
          }),
        ),
      );
    }

    for (const file of selected) {
      if (!assertFileAllowed(file)) {
        continue;
      }
      setUploadingCount((n) => n + 1);
      try {
        const item = await uploadMediaFile(file);
        next = [...next, item];
        onChange(next);
      } catch (error) {
        handleError(error);
      } finally {
        setUploadingCount((n) => Math.max(0, n - 1));
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">{t("inventory:media.fieldTitle")}</p>
        <FieldDescription>
          {readOnly
            ? t("inventory:media.descriptionReadOnly")
            : t("inventory:media.descriptionEditable")}
        </FieldDescription>
      </div>

      {readOnly ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((item, index) => (
            <div key={item.id}>
              <MediaThumb
                item={item}
                onPreview={() => {
                  setPreviewIndex(index);
                  setPreviewOpen(true);
                }}
              />
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {item.name}
              </p>
            </div>
          ))}
          {value.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              {t("inventory:media.noMedia")}
            </p>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {value.map((item, index) => (
                <SortableTile
                  key={item.id}
                  item={item}
                  onPreview={() => {
                    setPreviewIndex(index);
                    setPreviewOpen(true);
                  }}
                  onRemove={() => {
                    revokeIfBlobUrl(item.url);
                    onChange(value.filter((m) => m.id !== item.id));
                  }}
                />
              ))}
              {uploading && (
                <div className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground">
                  <Loader2Icon className="size-5 animate-spin" />
                  <span className="text-xs">
                    {t("inventory:media.uploading")}
                  </span>
                </div>
              )}
              {!uploading && value.length < MEDIA_GALLERY_MAX_ITEMS && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
                  <PlusIcon className="size-5" />
                  <span className="text-xs">
                    {t("inventory:media.addMedia")}
                  </span>
                  <input
                    type="file"
                    accept={ACCEPT}
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      void onPick(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <MediaPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={value}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
      />
    </div>
  );
}

type CoverImageFieldProps = {
  value: MediaItem | null;
  onChange: (next: MediaItem | null) => void;
  readOnly?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
};

export function CoverImageField({
  value,
  onChange,
  readOnly = false,
  onUploadingChange,
}: CoverImageFieldProps) {
  const { t } = useTranslation(["inventory", "common"]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const items = value ? [value] : [];

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    const [file] = Array.from(files);
    if (!file) {
      return;
    }
    if (!assertFileAllowed(file, true)) {
      return;
    }

    setUploading(true);
    try {
      const item = await uploadMediaFile(file);
      if (value) {
        revokeIfBlobUrl(value.url);
      }
      onChange(item);
    } catch (error) {
      handleError(error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">
          {t("inventory:media.cover.fieldTitle")}
        </p>
        <FieldDescription>
          {t("inventory:media.cover.description")}
        </FieldDescription>
      </div>

      {uploading ? (
        <div className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground sm:w-48">
          <Loader2Icon className="size-5 animate-spin" />
          <span className="text-xs">{t("inventory:media.uploading")}</span>
        </div>
      ) : value ? (
        <div className="flex items-start gap-3">
          <MediaThumb
            item={value}
            className="w-28"
            onPreview={() => {
              setPreviewOpen(true);
            }}
            overlay={
              readOnly ? undefined : (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  aria-label={t("inventory:media.cover.removeAria")}
                  onClick={() => {
                    revokeIfBlobUrl(value.url);
                    onChange(null);
                  }}
                >
                  <Trash2Icon />
                </Button>
              )
            }
          />
          <div className="flex flex-col gap-2">
            {!readOnly && (
              <label className="inline-flex cursor-pointer">
                <span className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted">
                  {t("inventory:media.cover.replace")}
                </span>
                <input
                  type="file"
                  accept={COVER_ACCEPT}
                  className="sr-only"
                  onChange={(event) => {
                    void onPick(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
            <p className="text-xs text-muted-foreground">{value.name}</p>
          </div>
        </div>
      ) : readOnly ? (
        <p className="text-sm text-muted-foreground">
          {t("inventory:media.cover.noCover")}
        </p>
      ) : (
        <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground sm:w-48">
          <PlusIcon className="size-5" />
          <span className="text-xs">{t("inventory:media.cover.upload")}</span>
          <input
            type="file"
            accept={COVER_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              void onPick(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      )}

      <MediaPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={items}
        index={0}
        onIndexChange={() => {
          // single item
        }}
      />
    </div>
  );
}
