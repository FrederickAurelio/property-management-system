/* anchor: Linear-dense form groups, diverge: amenity checkbox catalog */
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import type { Amenities } from "./inventory-types";
import { AMENITY_GROUPS, type AmenityGroupKey } from "./amenity-catalog";

type AmenitiesFieldProps = {
  value: Amenities;
  onChange: (next: Amenities) => void;
  readOnly?: boolean;
};

function toggleCode(
  list: string[],
  code: string,
  checked: boolean,
): string[] {
  if (checked) {
    return list.includes(code) ? list : [...list, code];
  }
  return list.filter((item) => item !== code);
}

export function AmenitiesField({
  value,
  onChange,
  readOnly = false,
}: AmenitiesFieldProps) {
  function setGroup(key: AmenityGroupKey, code: string, checked: boolean) {
    onChange({
      ...value,
      [key]: toggleCode(value[key], code, checked),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium">Amenities</p>
        <p className="text-xs text-muted-foreground">
          Shared for every unit of this type. Codes match the inventory contract.
        </p>
      </div>
      {AMENITY_GROUPS.map((group) => (
        <FieldSet key={group.key} className="gap-2.5">
          <FieldLegend variant="label">{group.label}</FieldLegend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.options.map((option) => {
              const checked = value[group.key].includes(option.code);
              const id = `amenity-${group.key}-${option.code}`;
              return (
                <Field
                  key={option.code}
                  orientation="horizontal"
                  className="items-center gap-2"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={readOnly}
                    onCheckedChange={(next) => {
                      setGroup(group.key, option.code, next === true);
                    }}
                  />
                  <Label htmlFor={id} className="font-normal">
                    {option.label}
                  </Label>
                </Field>
              );
            })}
          </div>
        </FieldSet>
      ))}
      <FieldDescription>
        Unknown future codes stay in data; this form edits the known catalog.
      </FieldDescription>
    </div>
  );
}
