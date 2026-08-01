/* anchor: Linear-dense form groups, diverge: multi-bed rooms → bedConfig JSON */
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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
import { getBedKindOptions } from "./amenity-catalog";

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
  const { t } = useTranslation(["inventory", "common"]);
  const bedKindOptions = getBedKindOptions();

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
        room:
          value.length === 0
            ? t("inventory:bedConfig.defaultStudioRoomName")
            : t("inventory:bedConfig.defaultBedroomName", { n }),
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
        <p className="text-sm font-medium">
          {t("inventory:bedConfig.sectionTitle")}
        </p>
        <FieldDescription>
          {t("inventory:bedConfig.sectionDescription")}
        </FieldDescription>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("inventory:bedConfig.noRooms")}
        </p>
      )}

      {value.map((room, roomIndex) => (
        <div
          key={`room-${roomIndex}`}
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
        >
          <div className="flex items-start gap-2">
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor={`bed-room-${roomIndex}`}>
                {t("inventory:bedConfig.roomNameLabel")}
              </FieldLabel>
              <Input
                id={`bed-room-${roomIndex}`}
                value={room.room}
                disabled={readOnly}
                onChange={(event) => {
                  updateRoom(roomIndex, { room: event.target.value });
                }}
                placeholder={t("inventory:bedConfig.roomNamePlaceholder")}
                autoComplete="off"
              />
            </Field>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-6 shrink-0"
                aria-label={t("inventory:bedConfig.removeRoomAria", {
                  room:
                    room.room || t("inventory:bedConfig.removeRoomFallback"),
                })}
                onClick={() => {
                  removeRoom(roomIndex);
                }}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("inventory:bedConfig.bedsInRoom")}
            </p>
            {room.beds.map((bed, bedIndex) => (
              <div
                key={`bed-${roomIndex}-${bedIndex}`}
                className="grid grid-cols-[1fr_5rem_auto] items-end gap-2"
              >
                <Field>
                  <FieldLabel className="sr-only">
                    {t("inventory:bedConfig.bedTypeLabel")}
                  </FieldLabel>
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
                        {bedKindOptions.map((option) => (
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
                    {t("inventory:bedConfig.bedCountLabel")}
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
                    aria-label={t("inventory:bedConfig.bedCountAria")}
                  />
                </Field>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mb-0.5"
                    disabled={room.beds.length <= 1}
                    aria-label={t("inventory:bedConfig.removeBedAria")}
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
                {t("inventory:bedConfig.addBed")}
              </Button>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={addRoom}>
          <PlusIcon data-icon="inline-start" />
          {t("inventory:bedConfig.addRoom")}
        </Button>
      )}
    </div>
  );
}
