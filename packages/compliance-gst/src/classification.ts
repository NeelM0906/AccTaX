import { isValidGstin } from "./gstin";
import type { SupplyClassification, SupplyTaxability } from "./types";

export interface ClassifySupplyInput {
  recipientGstin?: string;
  isRecipientRegistered?: boolean;
  isExport?: boolean;
  isSezSupply?: boolean;
  taxability?: SupplyTaxability;
}

export function classifySupply(input: ClassifySupplyInput): SupplyClassification {
  if (input.taxability === "non_gst") {
    return "non_gst";
  }

  if (input.taxability === "exempt") {
    return "exempt";
  }

  if (input.taxability === "nil_rated") {
    return "nil";
  }

  if (input.isExport === true) {
    return "export";
  }

  if (input.isSezSupply === true) {
    return "sez";
  }

  if (input.isRecipientRegistered === true) {
    return "b2b";
  }

  if (input.recipientGstin !== undefined && isValidGstin(input.recipientGstin)) {
    return "b2b";
  }

  return "b2c";
}

export function isNilExemptOrNonGst(classification: SupplyClassification): boolean {
  return classification === "nil" || classification === "exempt" || classification === "non_gst";
}

export function isZeroRated(classification: SupplyClassification): boolean {
  return classification === "export" || classification === "sez";
}

