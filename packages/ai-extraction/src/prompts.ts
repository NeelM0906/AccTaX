import type { ExtractionDocumentKind } from "./provider";

export type PromptTemplateOptions = {
  locale?: "en-IN" | "en-US" | "en-CA" | "generic";
  organisationContext?: string;
};

const extractedFieldShape = `{
  "value": "typed value or null",
  "confidence": 0.0,
  "source": {
    "page": 1,
    "rawText": "supporting text copied from the document"
  }
}`;

const sharedInstructions = [
  "Return JSON only. Do not include markdown or commentary.",
  "Use the ExtractedField shape for scalar fields.",
  "Set value to null when the evidence is missing or ambiguous.",
  "Confidence must be a number from 0 to 1 based only on document evidence.",
  "Use ISO dates in YYYY-MM-DD format.",
  "Use the document currency as an ISO code when visible. Use INR only when the document explicitly uses INR/Rs/₹ or India GST evidence.",
  "Do not infer compliance-critical values that are not present in the document."
].join("\n");

export function renderInvoiceBillReceiptPrompt(
  options: PromptTemplateOptions = {}
): string {
  return [
    "Extract an accounting invoice, bill, or receipt for human review.",
    sharedInstructions,
    options.organisationContext
      ? `Organisation context: ${options.organisationContext}`
      : undefined,
    "Scalar field shape:",
    extractedFieldShape,
    "Top-level JSON keys: documentType, documentNumber, documentDate, dueDate, supplierName, supplierGstin, supplierAddress, buyerName, buyerGstin, buyerAddress, placeOfSupply, currency, subtotal, discountTotal, taxableValue, cgstTotal, sgstTotal, igstTotal, cessTotal, totalTax, totalAmount, roundOff, paymentTerms, notes, lineItems.",
    "Set supplierGstin, buyerGstin, placeOfSupply, HSN/SAC, CGST, SGST, and IGST to null when those India-specific values are not visibly present.",
    "Line item keys: description, hsnSac, quantity, unit, unitPrice, taxableValue, cgstRate, sgstRate, igstRate, cessRate, taxAmount, totalAmount."
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function renderBankStatementPrompt(
  options: PromptTemplateOptions = {}
): string {
  return [
    "Extract an India bank statement for accounting review.",
    sharedInstructions,
    options.organisationContext
      ? `Organisation context: ${options.organisationContext}`
      : undefined,
    "Scalar field shape:",
    extractedFieldShape,
    "Top-level JSON keys: bankName, branchName, accountHolderName, accountNumber, ifsc, statementPeriodStart, statementPeriodEnd, currency, openingBalance, closingBalance, transactions.",
    "Transaction keys: transactionDate, valueDate, description, reference, type, amount, balanceAfterTransaction, counterparty, upiId, chequeNumber, categoryHint.",
    "For transaction type, use credit when money enters the account and debit when money leaves the account."
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function renderExtractionPrompt(
  documentKind: ExtractionDocumentKind,
  options: PromptTemplateOptions = {}
): string {
  if (documentKind === "bank_statement") {
    return renderBankStatementPrompt(options);
  }

  return renderInvoiceBillReceiptPrompt(options);
}
