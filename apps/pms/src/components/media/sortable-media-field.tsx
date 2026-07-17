/* anchor: Notion media grid / Linear attachments, diverge: dnd-kit sort + preview */
import { useMemo, useState } from "react";
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
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";
import { handleError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MediaPreviewDialog } from "./media-preview-dialog";
import { MediaThumb } from "./media-thumb";
import { mediaKindFromMime, type MediaItem } from "./types";

const ACCEPT =
  "image/*,video/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.svg,.bmp,.heic,.heif,.mp4,.webm,.mov,.m4v,.avi,.mkv";

function newMediaId(): string {
  // MOCK — client-generated media id; API upload returns asset id.
  return `media_${crypto.randomUUID().slice(0, 10)}`;
}

// MOCK — local file pick + blob preview; replace with upload API then store URLs.
async function filesToMediaItems(fileList: FileList | File[]): Promise<MediaItem[]> {
  const files = Array.from(fileList);
  const items: MediaItem[] = [];
  for (const file of files) {
    const kind = mediaKindFromMime(file.type);
    if (!kind) {
      handleError(new Error(`Unsupported file type: ${file.name || file.type}`));
      continue;
    }
    items.push({
      id: newMediaId(),
      kind,
      url: URL.createObjectURL(file),
      name: file.name || `${kind.toLowerCase()}-${items.length + 1}`,
      mimeType: file.type,
    });
  }
  return items;
}

type SortableTileProps = {
  item: MediaItem;
  onPreview: () => void;
  onRemove: () => void;
};

function SortableTile({ item, onPreview, onRemove }: SortableTileProps) {
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
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              className="cursor-grab touch-none active:cursor-grabbing"
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
            >
              <GripVerticalIcon />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              aria-label={`Remove ${item.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              <Trash2Icon />
            </Button>
          </>
        }
      />
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.name}</p>
    </div>
  );
}

type SortableMediaFieldProps = {
  value: MediaItem[];
  onChange: (next: MediaItem[]) => void;
};

export function SortableMediaField({
  value,
  onChange,
}: SortableMediaFieldProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const ids = useMemo(() => value.map((item) => item.id), [value]);

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
    const added = await filesToMediaItems(files);
    if (added.length > 0) {
      onChange([...value, ...added]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">Media</p>
        <FieldDescription>
          Images and videos. Drag to set order — the first image is the card
          thumbnail. Desktop: hover eye to preview. Mobile: long-press to
          preview.
        </FieldDescription>
      </div>

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
                  onChange(value.filter((m) => m.id !== item.id));
                }}
              />
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
              <PlusIcon className="size-5" />
              <span className="text-xs">Add media</span>
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
          </div>
        </SortableContext>
      </DndContext>

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
};

export function CoverImageField({ value, onChange }: CoverImageFieldProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const items = value ? [value] : [];

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    const [file] = Array.from(files);
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      handleError(new Error("Cover must be an image"));
      return;
    }
    if (value?.url.startsWith("blob:")) {
      // MOCK — revoke blob URL from local preview; not needed after API upload.
      URL.revokeObjectURL(value.url);
    }
    onChange({
      id: newMediaId(),
      kind: "IMAGE",
      // MOCK — blob preview URL; replace with uploaded asset URL from API.
      url: URL.createObjectURL(file),
      name: file.name || "cover",
      mimeType: file.type,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">Cover image</p>
        <FieldDescription>
          One image used on the properties list for quick recognition.
        </FieldDescription>
      </div>

      {value ? (
        <div className="flex items-start gap-3">
          <MediaThumb
            item={value}
            className="w-28"
            onPreview={() => {
              setPreviewOpen(true);
            }}
            overlay={
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                aria-label="Remove cover"
                onClick={() => {
                  if (value.url.startsWith("blob:")) {
                    // MOCK — revoke blob URL from local preview.
                    URL.revokeObjectURL(value.url);
                  }
                  onChange(null);
                }}
              >
                <Trash2Icon />
              </Button>
            }
          />
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer">
              <span className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted">
                Replace
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  void onPick(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">{value.name}</p>
          </div>
        </div>
      ) : (
        <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground sm:w-48">
          <PlusIcon className="size-5" />
          <span className="text-xs">Upload cover</span>
          <input
            type="file"
            accept="image/*"
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
