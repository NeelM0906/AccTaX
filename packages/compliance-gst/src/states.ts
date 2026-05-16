import { validationIssue, type ValidationResult } from "./errors";
import type { GstState, GstStateCode, PlaceOfSupplyKind } from "./types";

export const GST_STATES = [
  { code: "01", name: "Jammu and Kashmir", kind: "union_territory" },
  { code: "02", name: "Himachal Pradesh", kind: "state" },
  { code: "03", name: "Punjab", kind: "state" },
  { code: "04", name: "Chandigarh", kind: "union_territory" },
  { code: "05", name: "Uttarakhand", kind: "state" },
  { code: "06", name: "Haryana", kind: "state" },
  { code: "07", name: "Delhi", kind: "union_territory" },
  { code: "08", name: "Rajasthan", kind: "state" },
  { code: "09", name: "Uttar Pradesh", kind: "state" },
  { code: "10", name: "Bihar", kind: "state" },
  { code: "11", name: "Sikkim", kind: "state" },
  { code: "12", name: "Arunachal Pradesh", kind: "state" },
  { code: "13", name: "Nagaland", kind: "state" },
  { code: "14", name: "Manipur", kind: "state" },
  { code: "15", name: "Mizoram", kind: "state" },
  { code: "16", name: "Tripura", kind: "state" },
  { code: "17", name: "Meghalaya", kind: "state" },
  { code: "18", name: "Assam", kind: "state" },
  { code: "19", name: "West Bengal", kind: "state" },
  { code: "20", name: "Jharkhand", kind: "state" },
  { code: "21", name: "Odisha", kind: "state" },
  { code: "22", name: "Chhattisgarh", kind: "state" },
  { code: "23", name: "Madhya Pradesh", kind: "state" },
  { code: "24", name: "Gujarat", kind: "state" },
  { code: "25", name: "Daman and Diu", kind: "union_territory" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", kind: "union_territory" },
  { code: "27", name: "Maharashtra", kind: "state" },
  { code: "28", name: "Andhra Pradesh", kind: "state" },
  { code: "29", name: "Karnataka", kind: "state" },
  { code: "30", name: "Goa", kind: "state" },
  { code: "31", name: "Lakshadweep", kind: "union_territory" },
  { code: "32", name: "Kerala", kind: "state" },
  { code: "33", name: "Tamil Nadu", kind: "state" },
  { code: "34", name: "Puducherry", kind: "union_territory" },
  { code: "35", name: "Andaman and Nicobar Islands", kind: "union_territory" },
  { code: "36", name: "Telangana", kind: "state" },
  { code: "37", name: "Andhra Pradesh", kind: "state" },
  { code: "38", name: "Ladakh", kind: "union_territory" },
  { code: "97", name: "Other Territory", kind: "other" }
] as const satisfies readonly GstState[];

const STATE_BY_CODE = new Map<string, GstState>(GST_STATES.map((state) => [state.code, state]));

export interface PlaceOfSupplyInput {
  supplierStateCode: GstStateCode;
  placeOfSupplyStateCode: GstStateCode;
  isExport?: boolean;
  isSezSupply?: boolean;
}

export function normalizeStateCode(value: string): GstStateCode | null {
  const trimmed = value.trim();

  if (/^\d$/.test(trimmed)) {
    return `0${trimmed}`;
  }

  if (/^\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function getGstState(code: string): GstState | null {
  const normalized = normalizeStateCode(code);
  return normalized === null ? null : (STATE_BY_CODE.get(normalized) ?? null);
}

export function isKnownGstStateCode(code: string): boolean {
  return getGstState(code) !== null;
}

export function validateStateCode(code: string, path = "stateCode"): ValidationResult<GstStateCode> {
  const normalized = normalizeStateCode(code);
  const issues = [];

  if (normalized === null) {
    issues.push(validationIssue("GST_STATE_FORMAT", "GST state code must be two digits.", path));
  } else if (!isKnownGstStateCode(normalized)) {
    issues.push(validationIssue("GST_STATE_UNKNOWN", `Unknown GST state code ${normalized}.`, path));
  }

  return {
    valid: issues.length === 0,
    value: issues.length === 0 && normalized !== null ? normalized : undefined,
    issues
  };
}

export function getStateCodeFromGstin(gstin: string): GstStateCode | null {
  return normalizeStateCode(gstin.slice(0, 2));
}

export function isSameGstState(left: string, right: string): boolean {
  const normalizedLeft = normalizeStateCode(left);
  const normalizedRight = normalizeStateCode(right);

  return normalizedLeft !== null && normalizedRight !== null && normalizedLeft === normalizedRight;
}

export function getPlaceOfSupplyKind(input: PlaceOfSupplyInput): PlaceOfSupplyKind {
  if (input.isExport === true || input.isSezSupply === true) {
    return "interstate";
  }

  return isSameGstState(input.supplierStateCode, input.placeOfSupplyStateCode)
    ? "intrastate"
    : "interstate";
}

