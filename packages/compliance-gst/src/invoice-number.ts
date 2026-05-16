import { validationIssue, type ValidationResult } from "./errors";

const INVOICE_NUMBER_PATTERN = /^[A-Za-z0-9/-]+$/;
const MAX_INVOICE_NUMBER_LENGTH = 16;

export interface InvoiceNumberValidationOptions {
  existingInvoiceNumbers?: Iterable<string>;
  path?: string;
}

export function normalizeInvoiceNumber(invoiceNumber: string): string {
  return invoiceNumber.trim();
}

export function validateInvoiceNumber(
  invoiceNumber: string,
  options: InvoiceNumberValidationOptions = {}
): ValidationResult<string> {
  const path = options.path ?? "invoiceNumber";
  const normalized = normalizeInvoiceNumber(invoiceNumber);
  const issues = [];

  if (invoiceNumber !== normalized) {
    issues.push(validationIssue("INVOICE_NUMBER_WHITESPACE", "Invoice number cannot have surrounding whitespace.", path));
  }

  if (normalized.length === 0) {
    issues.push(validationIssue("INVOICE_NUMBER_EMPTY", "Invoice number is required.", path));
  }

  if (normalized.length > MAX_INVOICE_NUMBER_LENGTH) {
    issues.push(
      validationIssue(
        "INVOICE_NUMBER_LENGTH",
        `Invoice number cannot exceed ${MAX_INVOICE_NUMBER_LENGTH} characters.`,
        path
      )
    );
  }

  if (normalized.length > 0 && !INVOICE_NUMBER_PATTERN.test(normalized)) {
    issues.push(
      validationIssue(
        "INVOICE_NUMBER_CHARACTERS",
        "Invoice number may contain only letters, numbers, slash, and hyphen.",
        path
      )
    );
  }

  if (options.existingInvoiceNumbers !== undefined) {
    const normalizedExisting = new Set(
      Array.from(options.existingInvoiceNumbers, (value) => normalizeInvoiceNumber(value).toUpperCase())
    );

    if (normalizedExisting.has(normalized.toUpperCase())) {
      issues.push(
        validationIssue(
          "INVOICE_NUMBER_DUPLICATE",
          "Invoice number must be unique within the financial year.",
          path
        )
      );
    }
  }

  return {
    valid: issues.length === 0,
    value: issues.length === 0 ? normalized : undefined,
    issues
  };
}

export function isValidInvoiceNumber(invoiceNumber: string): boolean {
  return validateInvoiceNumber(invoiceNumber).valid;
}

