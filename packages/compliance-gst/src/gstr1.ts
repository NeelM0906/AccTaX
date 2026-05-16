import { classifySupply, isNilExemptOrNonGst } from "./classification";
import { validateGstin } from "./gstin";
import { validateInvoiceNumber } from "./invoice-number";
import { addMoney, roundMoney } from "./money";
import { GST_RULE_VERSION } from "./rule-version";
import { calculateGstTax } from "./tax";
import type { ComplianceValidationIssue } from "./errors";
import type { GstInvoiceInput, GstTaxBreakup, SupplyClassification } from "./types";

export interface Gstr1RateSummary {
  rate: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface Gstr1InvoiceSummary {
  recipientGstin?: string;
  invoiceNumber: string;
  invoiceDate: string;
  placeOfSupplyStateCode: string;
  invoiceValue: number;
  supplyType: "intrastate" | "interstate";
  reverseCharge: boolean;
  lines: Gstr1RateSummary[];
}

export interface Gstr1B2cSummary extends Gstr1RateSummary {
  placeOfSupplyStateCode: string;
}

export interface Gstr1NilSummary {
  nilRated: number;
  exempt: number;
  nonGst: number;
  total: number;
}

export interface Gstr1Draft {
  ruleVersion: string;
  b2b: Gstr1InvoiceSummary[];
  b2cl: Gstr1InvoiceSummary[];
  b2cs: Gstr1B2cSummary[];
  exports: Gstr1InvoiceSummary[];
  sez: Gstr1InvoiceSummary[];
  nil: Gstr1NilSummary;
  issues: ComplianceValidationIssue[];
}

interface MutableInvoiceSummary extends Omit<Gstr1InvoiceSummary, "lines"> {
  lines: Map<string, Gstr1RateSummary>;
}

export function buildGstr1Draft(invoices: readonly GstInvoiceInput[]): Gstr1Draft {
  const issues: ComplianceValidationIssue[] = [];
  const b2b = new Map<string, MutableInvoiceSummary>();
  const b2cl = new Map<string, MutableInvoiceSummary>();
  const exports = new Map<string, MutableInvoiceSummary>();
  const sez = new Map<string, MutableInvoiceSummary>();
  const b2cs = new Map<string, Gstr1B2cSummary>();
  const nil: Gstr1NilSummary = { nilRated: 0, exempt: 0, nonGst: 0, total: 0 };

  for (const invoice of invoices) {
    issues.push(...validateInvoiceNumber(invoice.invoiceNumber, { path: `${invoice.invoiceNumber}.invoiceNumber` }).issues);

    if (invoice.recipientGstin !== undefined) {
      issues.push(...validateGstin(invoice.recipientGstin, `${invoice.invoiceNumber}.recipientGstin`).issues);
    }

    const placeOfSupplyStateCode =
      invoice.placeOfSupplyStateCode ?? invoice.recipientStateCode ?? invoice.supplierStateCode;
    const invoiceValue = calculateInvoiceValue(invoice, placeOfSupplyStateCode);

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
        addNilSummary(nil, classification, tax.taxableValue);
        continue;
      }

      if (classification === "b2b") {
        addInvoiceLine(b2b, invoice, placeOfSupplyStateCode, tax);
      } else if (classification === "export") {
        addInvoiceLine(exports, invoice, placeOfSupplyStateCode, tax);
      } else if (classification === "sez") {
        addInvoiceLine(sez, invoice, placeOfSupplyStateCode, tax);
      } else if (tax.placeOfSupplyKind === "interstate" && invoiceValue > GST_RULE_VERSION.thresholds.b2cLargeInterStateInvoiceValue) {
        addInvoiceLine(b2cl, invoice, placeOfSupplyStateCode, tax);
      } else {
        addB2cSmallLine(b2cs, placeOfSupplyStateCode, tax);
      }
    }
  }

  return {
    ruleVersion: GST_RULE_VERSION.id,
    b2b: serializeInvoiceMap(b2b),
    b2cl: serializeInvoiceMap(b2cl),
    b2cs: Array.from(b2cs.values()).sort(compareB2cSummary),
    exports: serializeInvoiceMap(exports),
    sez: serializeInvoiceMap(sez),
    nil,
    issues
  };
}

function calculateInvoiceValue(invoice: GstInvoiceInput, placeOfSupplyStateCode: string): number {
  return invoice.lines.reduce((total, line) => {
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

    return addMoney(total, tax.invoiceValue);
  }, 0);
}

function addInvoiceLine(
  invoices: Map<string, MutableInvoiceSummary>,
  invoice: GstInvoiceInput,
  placeOfSupplyStateCode: string,
  tax: GstTaxBreakup
): void {
  const key = `${invoice.recipientGstin ?? "URP"}|${invoice.invoiceNumber}|${invoice.invoiceDate}`;
  const existing = invoices.get(key);
  const summary =
    existing ??
    {
      recipientGstin: invoice.recipientGstin,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      placeOfSupplyStateCode,
      invoiceValue: 0,
      supplyType: tax.placeOfSupplyKind,
      reverseCharge: invoice.reverseCharge ?? false,
      lines: new Map<string, Gstr1RateSummary>()
    };

  summary.invoiceValue = addMoney(summary.invoiceValue, tax.invoiceValue);
  addRateSummary(summary.lines, tax);
  invoices.set(key, summary);
}

function addB2cSmallLine(summaries: Map<string, Gstr1B2cSummary>, placeOfSupplyStateCode: string, tax: GstTaxBreakup): void {
  const key = `${placeOfSupplyStateCode}|${tax.gstRate}`;
  const existing = summaries.get(key);
  const summary =
    existing ??
    {
      placeOfSupplyStateCode,
      rate: tax.gstRate,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0
    };

  summary.taxableValue = addMoney(summary.taxableValue, tax.taxableValue);
  summary.igst = addMoney(summary.igst, tax.igst);
  summary.cgst = addMoney(summary.cgst, tax.cgst);
  summary.sgst = addMoney(summary.sgst, tax.sgst);
  summary.cess = addMoney(summary.cess, tax.cess);
  summaries.set(key, summary);
}

function addRateSummary(lines: Map<string, Gstr1RateSummary>, tax: GstTaxBreakup): void {
  const key = String(tax.gstRate);
  const existing = lines.get(key);
  const summary =
    existing ??
    {
      rate: tax.gstRate,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0
    };

  summary.taxableValue = addMoney(summary.taxableValue, tax.taxableValue);
  summary.igst = addMoney(summary.igst, tax.igst);
  summary.cgst = addMoney(summary.cgst, tax.cgst);
  summary.sgst = addMoney(summary.sgst, tax.sgst);
  summary.cess = addMoney(summary.cess, tax.cess);
  lines.set(key, summary);
}

function addNilSummary(summary: Gstr1NilSummary, classification: SupplyClassification, amount: number): void {
  if (classification === "nil") {
    summary.nilRated = addMoney(summary.nilRated, amount);
  } else if (classification === "exempt") {
    summary.exempt = addMoney(summary.exempt, amount);
  } else if (classification === "non_gst") {
    summary.nonGst = addMoney(summary.nonGst, amount);
  }

  summary.total = roundMoney(summary.nilRated + summary.exempt + summary.nonGst);
}

function serializeInvoiceMap(invoices: Map<string, MutableInvoiceSummary>): Gstr1InvoiceSummary[] {
  return Array.from(invoices.values())
    .map((invoice) => ({
      ...invoice,
      lines: Array.from(invoice.lines.values()).sort((left, right) => left.rate - right.rate)
    }))
    .sort(compareInvoiceSummary);
}

function compareInvoiceSummary(left: Gstr1InvoiceSummary, right: Gstr1InvoiceSummary): number {
  return `${left.invoiceDate}|${left.invoiceNumber}`.localeCompare(`${right.invoiceDate}|${right.invoiceNumber}`);
}

function compareB2cSummary(left: Gstr1B2cSummary, right: Gstr1B2cSummary): number {
  return `${left.placeOfSupplyStateCode}|${left.rate}`.localeCompare(`${right.placeOfSupplyStateCode}|${right.rate}`);
}

