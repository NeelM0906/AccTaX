import { GST_RULE_VERSION } from "./rule-version";
import type { DocumentType, SupplyClassification } from "./types";

export type EInvoiceTaxpayerCategory =
  | "regular"
  | "government_department"
  | "local_authority"
  | "sez_unit"
  | "insurer"
  | "banking_company"
  | "financial_institution"
  | "nbfc"
  | "gta"
  | "passenger_transport"
  | "cinema_multiplex";

export interface ThresholdResult {
  applicable: boolean;
  threshold: number;
  reasons: string[];
}

export interface EInvoiceApplicabilityInput {
  aggregateTurnover: number;
  documentDate?: string | Date;
  documentType?: DocumentType;
  supplyClassification: SupplyClassification;
  taxpayerCategory?: EInvoiceTaxpayerCategory;
}

export interface EWayBillApplicabilityInput {
  consignmentValue: number;
  supplyKind?: "goods" | "services";
  forceRequiredReason?: string;
}

const E_INVOICE_EFFECTIVE_DATE = "2023-08-01";
const E_INVOICE_ALLOWED_CLASSIFICATIONS = new Set<SupplyClassification>(["b2b", "export", "sez"]);
const E_INVOICE_ALLOWED_DOCUMENTS = new Set<DocumentType>(["invoice", "credit_note", "debit_note"]);
const E_INVOICE_EXCLUDED_TAXPAYER_CATEGORIES = new Set<EInvoiceTaxpayerCategory>([
  "government_department",
  "local_authority",
  "sez_unit",
  "insurer",
  "banking_company",
  "financial_institution",
  "nbfc",
  "gta",
  "passenger_transport",
  "cinema_multiplex"
]);

export function isEInvoiceApplicable(input: EInvoiceApplicabilityInput): ThresholdResult {
  const reasons: string[] = [];
  const threshold = GST_RULE_VERSION.thresholds.eInvoiceAggregateTurnover;
  const documentType = input.documentType ?? "invoice";
  const taxpayerCategory = input.taxpayerCategory ?? "regular";

  if (input.documentDate !== undefined && compareIsoDate(input.documentDate, E_INVOICE_EFFECTIVE_DATE) < 0) {
    reasons.push("BEFORE_EFFECTIVE_DATE");
  }

  if (input.aggregateTurnover <= threshold) {
    reasons.push("TURNOVER_NOT_ABOVE_THRESHOLD");
  }

  if (!E_INVOICE_ALLOWED_DOCUMENTS.has(documentType)) {
    reasons.push("DOCUMENT_TYPE_NOT_SUPPORTED");
  }

  if (!E_INVOICE_ALLOWED_CLASSIFICATIONS.has(input.supplyClassification)) {
    reasons.push("SUPPLY_CLASSIFICATION_NOT_SUPPORTED");
  }

  if (E_INVOICE_EXCLUDED_TAXPAYER_CATEGORIES.has(taxpayerCategory)) {
    reasons.push("TAXPAYER_CATEGORY_EXCLUDED");
  }

  return {
    applicable: reasons.length === 0,
    threshold,
    reasons
  };
}

export function isEWayBillRequired(input: EWayBillApplicabilityInput): ThresholdResult {
  const reasons: string[] = [];
  const threshold = GST_RULE_VERSION.thresholds.eWayBillConsignmentValue;

  if (input.forceRequiredReason !== undefined) {
    return {
      applicable: true,
      threshold,
      reasons: [input.forceRequiredReason]
    };
  }

  if ((input.supplyKind ?? "goods") !== "goods") {
    reasons.push("EWAYBILL_ONLY_FOR_GOODS_MOVEMENT");
  }

  if (input.consignmentValue <= threshold) {
    reasons.push("CONSIGNMENT_VALUE_NOT_ABOVE_THRESHOLD");
  }

  return {
    applicable: reasons.length === 0,
    threshold,
    reasons
  };
}

function compareIsoDate(left: string | Date, rightIso: string): number {
  const leftIso = left instanceof Date ? left.toISOString().slice(0, 10) : left.slice(0, 10);

  return leftIso.localeCompare(rightIso);
}

