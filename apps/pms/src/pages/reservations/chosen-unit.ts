import type { StaffReservation } from "@cabin/api-contract";

export type ChosenUnit = {
  propertyId: string;
  propertyName: string;
  unitTypeId: string;
  unitTypeName: string;
  /** Daily rack — carried from picker or cache to avoid a detail GET. */
  defaultPriceIdr?: number;
  monthlyPriceIdr?: number;
  yearlyPriceIdr?: number;
  unitId: string;
  unitCode: string;
  unitName: string | null;
};

export function formatChosenUnitLabel(chosen: {
  unitCode: string;
  unitName?: string | null;
}): string {
  return chosen.unitName
    ? `${chosen.unitCode} · ${chosen.unitName}`
    : chosen.unitCode;
}

export function chosenFromReservation(row: StaffReservation): ChosenUnit {
  return {
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    unitTypeId: row.unitTypeId,
    unitTypeName: "",
    unitId: row.unitId,
    unitCode: row.unitCode,
    unitName: null,
  };
}
