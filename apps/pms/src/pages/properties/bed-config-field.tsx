/* anchor: Linear-dense form groups, diverge: multi-bed rooms → bedConfig JSON */
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BedConfigRoom, BedKind } from "./inventory-types";
import { BED_KIND_OPTIONS } from "./amenity-catalog";

type BedConfigFieldProps = {
  value: BedConfigRoom[];
  onChange: (next: BedConfigRoom[]) => void;
  readOnly?: boolean;
};

export function BedConfigField({
  value,
  onChange,
  readOnly = false,
}: BedConfigFieldProps) {
  function updateRoom(index: number, patch: Partial<BedConfigRoom>) {
    onChange(
      value.map((room, i) => {
        if (i !== index) {
          return room;
        }
        return { ...room, ...patch };
      }),
    );
  }

  function updateBed(
    roomIndex: number,
    bedIndex: number,
    patch: Partial<{ type: BedKind; count: number }>,
  ) {
    const room = value[roomIndex];
    if (!room) {
      return;
    }
    const beds = room.beds.map((bed, i) => {
      if (i !== bedIndex) {
        return bed;
      }
      return { ...bed, ...patch };
    });
    updateRoom(roomIndex, { beds });
  }

  function addBed(roomIndex: number) {
    const room = value[roomIndex];
    if (!room) {
      return;
    }
    updateRoom(roomIndex, {
      beds: [...room.beds, { type: "SINGLE", count: 1 }],
    });
  }

  function removeBed(roomIndex: number, bedIndex: number) {
    const room = value[roomIndex];
    if (!room) {
      return;
    }
    if (room.beds.length <= 1) {
      return;
    }
    updateRoom(roomIndex, {
      beds: room.beds.filter((_, i) => i !== bedIndex),
    });
  }

  function addRoom() {
    const n = value.length + 1;
    onChange([
      ...value,
      {
        room: value.length === 0 ? "Studio" : `Bedroom ${n}`,
        beds: [{ type: "DOUBLE", count: 1 }],
      },
    ]);
  }

  function removeRoom(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">Rooms & beds</p>
        <FieldDescription>
          Each room can have several beds (e.g. 1 queen + 1 single). Bedroom
          count above follows the number of rooms here.
        </FieldDescription>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">No rooms yet.</p>
      )}

      {value.map((room, roomIndex) => (
        <div
          key={`room-${roomIndex}`}
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
        >
          <div className="flex items-start gap-2">
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor={`bed-room-${roomIndex}`}>Room name</FieldLabel>
              <Input
                id={`bed-room-${roomIndex}`}
                value={room.room}
                disabled={readOnly}
                onChange={(event) => {
                  updateRoom(roomIndex, { room: event.target.value });
                }}
                placeholder="Bedroom 1"
                autoComplete="off"
              />
            </Field>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-6 shrink-0"
                aria-label={`Remove ${room.room || "room"}`}
                onClick={() => {
                  removeRoom(roomIndex);
                }}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Beds in this room</p>
            {room.beds.map((bed, bedIndex) => (
              <div
                key={`bed-${roomIndex}-${bedIndex}`}
                className="grid grid-cols-[1fr_5rem_auto] items-end gap-2"
              >
                <Field>
                  <FieldLabel className="sr-only">Bed type</FieldLabel>
                  <Select
                    value={bed.type}
                    disabled={readOnly}
                    onValueChange={(next) => {
                      updateBed(roomIndex, bedIndex, {
                        type: next as BedKind,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {BED_KIND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel
                    htmlFor={`bed-count-${roomIndex}-${bedIndex}`}
                    className="sr-only"
                  >
                    Count
                  </FieldLabel>
                  <Input
                    id={`bed-count-${roomIndex}-${bedIndex}`}
                    type="number"
                    min={1}
                    max={10}
                    value={bed.count}
                    disabled={readOnly}
                    onChange={(event) => {
                      const n = Number(event.target.value);
                      updateBed(roomIndex, bedIndex, {
                        count: Number.isFinite(n) && n >= 1 ? n : 1,
                      });
                    }}
                    aria-label="Bed count"
                  />
                </Field>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mb-0.5"
                    disabled={room.beds.length <= 1}
                    aria-label="Remove bed"
                    onClick={() => {
                      removeBed(roomIndex, bedIndex);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            ))}
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  addBed(roomIndex);
                }}
              >
                <PlusIcon data-icon="inline-start" />
                Add bed
              </Button>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={addRoom}>
          <PlusIcon data-icon="inline-start" />
          Add room
        </Button>
      )}
    </div>
  );
}
