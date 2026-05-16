import { classifySupply, isNilExemptOrNonGst, isZeroRated } from "./classification";
import { addMoney } from "./money";
import { GST_RULE_VERSION } from "./rule-version";
import { calculateGstTax } from "./tax";
import type { GstInvoiceInput, GstTaxBreakup } from "./types";

export interface Gstr3bTaxSummary {
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface Gstr3bInterStateUnregisteredSummary extends Gstr3bTaxSummary {
  placeOfSupplyStateCode: string;
}

export interface Gstr3bSummary {
  ruleVersion: string;
  outwardTaxableSupplies: Gstr3bTaxSummary;
  outwardZeroRatedSupplies: Gstr3bTaxSummary;
  outwardNilExemptNonGstSupplies: Gstr3bTaxSummary;
  interStateUnregisteredSupplies: Gstr3bInterStateUnregisteredSummary[];
}

export function buildGstr3bSummary(invoices: readonly GstInvoiceInput[]): Gstr3bSummary {
  const outwardTaxableSupplies = emptySummary();
  const outwardZeroRatedSupplies = emptySummary();
  const outwardNilExemptNonGstSupplies = emptySummary();
  const interStateUnregisteredSupplies = new Map<string, Gstr3bInterStateUnregisteredSummary>();

  for (const invoice of invoices) {
    const placeOfSupplyStateCode =
      invoice.placeOfSupplyStateCode ?? invoice.recipientStateCode ?? invoice.supplierStateCode;

    for (const line of invoice.lines) {
      const classification = classifySupply({
        recipientGstin: invoice.recipientGstin,
        isRecipientRegistered: invoice.isRecipientRegistered,
        isExport: invoice.isExport,
        isSezSupply: invoice.isSezSupply,
        taxability: line.taxability
      });
      const tax = calculateGstTax({
        taxableValue: line.taxableValue,
        gstRate: line.gstRate,
        supplierStateCode: invoice.supplierStateCode,
        placeOfSupplyStateCode,
        taxability: line.taxability,
        isExport: invoice.isExport,
        isSezSupply: invoice.isSezSupply,
        exportType: invoice.exportType,
        cessAmount: line.cessAmount
      });

      if (isNilExemptOrNonGst(classification)) {
        addTax(outwardNilExemptNonGstSupplies, tax);
      } else if (isZeroRated(classification)) {
        addTax(outwardZeroRatedSupplies, tax);
      } else {
        addTax(outwardTaxableSupplies, tax);

        if (classification === "b2c" && tax.placeOfSupplyKind === "interstate") {
          addInterStateUnregisteredTax(interStateUnregisteredSupplies, placeOfSupplyStateCode, tax);
        }
      }
    }
  }

  return {
    ruleVersion: GST_RULE_VERSION.id,
    outwardTaxableSupplies,
    outwardZeroRatedSupplies,
    outwardNilExemptNonGstSupplies,
    interStateUnregisteredSupplies: Array.from(interStateUnregisteredSupplies.values()).sort((left, right) =>
      left.placeOfSupplyStateCode.localeCompare(right.placeOfSupplyStateCode)
    )
  };
}

function emptySummary(): Gstr3bTaxSummary {
  return {
    taxableValue: 0,
    igst: 0,
    cgst: 0,
    sgst: 0,
    cess: 0
  };
}

function addTax(summary: Gstr3bTaxSummary, tax: GstTaxBreakup): void {
  summary.taxableValue = addMoney(summary.taxableValue, tax.taxableValue);
  summary.igst = addMoney(summary.igst, tax.igst);
  summary.cgst = addMoney(summary.cgst, tax.cgst);
  summary.sgst = addMoney(summary.sgst, tax.sgst);
  summary.cess = addMoney(summary.cess, tax.cess);
}

function addInterStateUnregisteredTax(
  summaries: Map<string, Gstr3bInterStateUnregisteredSummary>,
  placeOfSupplyStateCode: string,
  tax: GstTaxBreakup
): void {
  const existing = summaries.get(placeOfSupplyStateCode);
  const summary = existing ?? { placeOfSupplyStateCode, ...emptySummary() };
  addTax(summary, tax);
  summaries.set(placeOfSupplyStateCode, summary);
}

