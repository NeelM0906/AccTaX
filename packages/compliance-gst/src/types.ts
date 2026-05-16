export type RupeeAmount = number;
export type GstStateCode = string;

export type DocumentType = "invoice" | "credit_note" | "debit_note";
export type ExportType = "with_payment" | "without_payment";
export type PlaceOfSupplyKind = "intrastate" | "interstate";
export type SupplyTaxability = "taxable" | "nil_rated" | "exempt" | "non_gst";
export type SupplyClassification =
  | "b2b"
  | "b2c"
  | "export"
  | "sez"
  | "nil"
  | "exempt"
  | "non_gst";

export interface GstState {
  code: GstStateCode;
  name: string;
  kind: "state" | "union_territory" | "other";
}

export interface GstTaxBreakup {
  taxableValue: RupeeAmount;
  gstRate: number;
  placeOfSupplyKind: PlaceOfSupplyKind;
  igst: RupeeAmount;
  cgst: RupeeAmount;
  sgst: RupeeAmount;
  cess: RupeeAmount;
  totalTax: RupeeAmount;
  invoiceValue: RupeeAmount;
}

export interface GstInvoiceLineInput {
  description?: string;
  hsnSac?: string;
  taxableValue: RupeeAmount;
  gstRate: number;
  cessAmount?: RupeeAmount;
  taxability?: SupplyTaxability;
}

export interface GstInvoiceInput {
  id?: string;
  documentType?: DocumentType;
  invoiceNumber: string;
  invoiceDate: string;
  supplierGstin?: string;
  supplierStateCode: GstStateCode;
  recipientGstin?: string;
  recipientName?: string;
  recipientStateCode?: GstStateCode;
  placeOfSupplyStateCode?: GstStateCode;
  isRecipientRegistered?: boolean;
  isExport?: boolean;
  isSezSupply?: boolean;
  exportType?: ExportType;
  reverseCharge?: boolean;
  lines: GstInvoiceLineInput[];
}

export interface ClassifiedInvoiceLine extends GstInvoiceLineInput {
  classification: SupplyClassification;
  tax: GstTaxBreakup;
}

export interface InvoiceTotals {
  taxableValue: RupeeAmount;
  igst: RupeeAmount;
  cgst: RupeeAmount;
  sgst: RupeeAmount;
  cess: RupeeAmount;
  totalTax: RupeeAmount;
  invoiceValue: RupeeAmount;
}

