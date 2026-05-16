import type { ExtractedField } from "./fields";
import type { InvoiceBillReceiptExtraction } from "./schemas";

export type ExtractionValidationSeverity = "error" | "warning";

export type ExtractionValidationCode =
  | "missing_critical_field"
  | "low_confidence"
  | "invalid_gstin_shape";

export type ExtractionValidationIssue = {
  code: ExtractionValidationCode;
  severity: ExtractionValidationSeverity;
  path: string;
  message: string;
  confidence?: number;
  threshold?: number;
};

export type ExtractionValidationStatus =
  | "ready_for_review"
  | "needs_review"
  | "blocked";

export type ExtractionValidationResult = {
  status: ExtractionValidationStatus;
  issues: ExtractionValidationIssue[];
};

export type DeterministicValidationOptions = {
  criticalFields?: readonly string[];
  confidenceThreshold?: number;
  gstinFields?: readonly string[];
};

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;

export const DEFAULT_INVOICE_BILL_RECEIPT_CRITICAL_FIELDS = [
  "documentType",
  "documentNumber",
  "documentDate",
  "supplierName",
  "totalAmount"
] as const;

const DEFAULT_GSTIN_FIELDS = ["supplierGstin", "buyerGstin"] as const;
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[A-Z0-9]$/;

export function validateInvoiceBillReceiptExtraction(
  extraction: Partial<InvoiceBillReceiptExtraction>,
  options: DeterministicValidationOptions = {}
): ExtractionValidationResult {
  return validateExtraction(extraction, {
    criticalFields:
      options.criticalFields ?? DEFAULT_INVOICE_BILL_RECEIPT_CRITICAL_FIELDS,
    confidenceThreshold: options.confidenceThreshold,
    gstinFields: options.gstinFields ?? DEFAULT_GSTIN_FIELDS
  });
}

export function validateExtraction(
  extraction: unknown,
  options: DeterministicValidationOptions = {}
): ExtractionValidationResult {
  const issues: ExtractionValidationIssue[] = [];
  const confidenceThreshold =
    options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  for (const path of options.criticalFields ?? []) {
    const value = getPath(extraction, path);
    if (isMissingValue(value)) {
      issues.push({
        code: "missing_critical_field",
        severity: "error",
        path,
        message: `Critical field "${path}" is missing or empty`
      });
    }
  }

  collectLowConfidenceIssues(
    extraction,
    "",
    confidenceThreshold,
    issues
  );

  for (const path of options.gstinFields ?? []) {
    const field = getPath(extraction, path);
    const value = isExtractedField<string>(field) ? field.value : undefined;

    if (typeof value === "string" && value.trim().length > 0) {
      const normalized = value.trim().toUpperCase();
      if (!GSTIN_SHAPE.test(normalized)) {
        issues.push({
          code: "invalid_gstin_shape",
          severity: "warning",
          path,
          message: `GSTIN at "${path}" does not match the expected 15-character GSTIN shape`
        });
      }
    }
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");
  return {
    status: hasErrors
      ? "blocked"
      : issues.length > 0
        ? "needs_review"
        : "ready_for_review",
    issues
  };
}

function collectLowConfidenceIssues(
  value: unknown,
  path: string,
  threshold: number,
  issues: ExtractionValidationIssue[]
): void {
  if (isExtractedField(value)) {
    if (value.confidence < threshold) {
      issues.push({
        code: "low_confidence",
        severity: "warning",
        path,
        message: `Extraction confidence at "${path}" is below ${threshold}`,
        confidence: value.confidence,
        threshold
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectLowConfidenceIssues(item, `${path}[${index}]`, threshold, issues);
    });
    return;
  }

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      collectLowConfidenceIssues(child, childPath, threshold, issues);
    }
  }
}

function isMissingValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (isExtractedField(value)) {
    return value.value === null || value.value === "";
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

function getPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, source);
}

function isExtractedField<T = unknown>(value: unknown): value is ExtractedField<T> {
  return (
    isRecord(value) &&
    "value" in value &&
    typeof value.confidence === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
