/* anchor: Linear-dense form groups, diverge: amenity checkbox catalog */
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import type { Amenities } from "./inventory-types";
import { getAmenityGroups, type AmenityGroupKey } from "./amenity-catalog";

type AmenitiesFieldProps = {
  value: Amenities;
  onChange: (next: Amenities) => void;
  readOnly?: boolean;
};

function toggleCode(list: string[], code: string, checked: boolean): string[] {
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
  const { t } = useTranslation(["inventory", "common"]);

  function setGroup(key: AmenityGroupKey, code: string, checked: boolean) {
    onChange({
      ...value,
      [key]: toggleCode(value[key], code, checked),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium">
          {t("inventory:amenities.fieldTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("inventory:amenities.fieldDescription")}
        </p>
      </div>
      {getAmenityGroups().map((group) => (
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
        {t("inventory:amenities.unknownCodesHint")}
      </FieldDescription>
    </div>
  );
}
