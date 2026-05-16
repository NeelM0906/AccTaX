import { validationIssue } from "./errors";
import { addMoney, roundMoney, taxAmount } from "./money";
import { getPlaceOfSupplyKind, validateStateCode } from "./states";
import type {
  ExportType,
  GstInvoiceLineInput,
  GstTaxBreakup,
  InvoiceTotals,
  PlaceOfSupplyKind,
  RupeeAmount,
  SupplyTaxability
} from "./types";

export interface CalculateGstTaxInput {
  taxableValue: RupeeAmount;
  gstRate: number;
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  taxability?: SupplyTaxability;
  isExport?: boolean;
  isSezSupply?: boolean;
  exportType?: ExportType;
  cessAmount?: RupeeAmount;
}

export function calculateGstTax(input: CalculateGstTaxInput): GstTaxBreakup {
  const issues = [
    ...validateStateCode(input.supplierStateCode, "supplierStateCode").issues,
    ...validateStateCode(input.placeOfSupplyStateCode, "placeOfSupplyStateCode").issues
  ];

  if (!Number.isFinite(input.taxableValue) || input.taxableValue < 0) {
    issues.push(validationIssue("GST_TAXABLE_VALUE", "Taxable value must be a non-negative finite number.", "taxableValue"));
  }

  if (!Number.isFinite(input.gstRate) || input.gstRate < 0) {
    issues.push(validationIssue("GST_RATE", "GST rate must be a non-negative finite number.", "gstRate"));
  }

  if (issues.length > 0) {
    const message = issues.map((issue) => issue.message).join(" ");
    throw new Error(message);
  }

  const taxableValue = roundMoney(input.taxableValue);
  const cess = roundMoney(input.cessAmount ?? 0);
  const taxability = input.taxability ?? "taxable";
  const placeOfSupplyKind = getPlaceOfSupplyKind({
    supplierStateCode: input.supplierStateCode,
    placeOfSupplyStateCode: input.placeOfSupplyStateCode,
    isExport: input.isExport,
    isSezSupply: input.isSezSupply
  });

  if (taxability !== "taxable" || input.gstRate === 0 || input.exportType === "without_payment") {
    return emptyTaxBreakup(taxableValue, input.gstRate, placeOfSupplyKind, cess);
  }

  if (placeOfSupplyKind === "interstate") {
    const igst = taxAmount(taxableValue, input.gstRate);
    return buildTaxBreakup(taxableValue, input.gstRate, placeOfSupplyKind, igst, 0, 0, cess);
  }

  const cgst = taxAmount(taxableValue, input.gstRate / 2);
  const sgst = taxAmount(taxableValue, input.gstRate / 2);
  return buildTaxBreakup(taxableValue, input.gstRate, placeOfSupplyKind, 0, cgst, sgst, cess);
}

export function aggregateTaxBreakups(lines: readonly GstTaxBreakup[]): InvoiceTotals {
  return {
    taxableValue: addMoney(...lines.map((line) => line.taxableValue)),
    igst: addMoney(...lines.map((line) => line.igst)),
    cgst: addMoney(...lines.map((line) => line.cgst)),
    sgst: addMoney(...lines.map((line) => line.sgst)),
    cess: addMoney(...lines.map((line) => line.cess)),
    totalTax: addMoney(...lines.map((line) => line.totalTax)),
    invoiceValue: addMoney(...lines.map((line) => line.invoiceValue))
  };
}

export function lineTaxInput(
  line: GstInvoiceLineInput,
  supplierStateCode: string,
  placeOfSupplyStateCode: string,
  options: Pick<CalculateGstTaxInput, "isExport" | "isSezSupply" | "exportType"> = {}
): CalculateGstTaxInput {
  return {
    taxableValue: line.taxableValue,
    gstRate: line.gstRate,
    supplierStateCode,
    placeOfSupplyStateCode,
    taxability: line.taxability,
    cessAmount: line.cessAmount,
    ...options
  };
}

function emptyTaxBreakup(
  taxableValue: RupeeAmount,
  gstRate: number,
  placeOfSupplyKind: PlaceOfSupplyKind,
  cess: RupeeAmount
): GstTaxBreakup {
  return buildTaxBreakup(taxableValue, gstRate, placeOfSupplyKind, 0, 0, 0, cess);
}

function buildTaxBreakup(
  taxableValue: RupeeAmount,
  gstRate: number,
  placeOfSupplyKind: PlaceOfSupplyKind,
  igst: RupeeAmount,
  cgst: RupeeAmount,
  sgst: RupeeAmount,
  cess: RupeeAmount
): GstTaxBreakup {
  const totalTax = addMoney(igst, cgst, sgst, cess);

  return {
    taxableValue,
    gstRate,
    placeOfSupplyKind,
    igst,
    cgst,
    sgst,
    cess,
    totalTax,
    invoiceValue: addMoney(taxableValue, totalTax)
  };
}

