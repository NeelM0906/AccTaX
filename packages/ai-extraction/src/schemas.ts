import { z } from "zod";
import { extractedFieldSchema } from "./fields";

const finiteNumberSchema = z.number().refine(Number.isFinite, {
  message: "Expected a finite number"
});

const nonNegativeNumberSchema = z.number().min(0).refine(Number.isFinite, {
  message: "Expected a finite number"
});
const percentageSchema = z.number().min(0).max(100).refine(Number.isFinite, {
  message: "Expected a finite number"
});
const isoDateSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeDate(value) ?? value : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Expected date in YYYY-MM-DD format"
  })
);

export const commercialDocumentTypeSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeDocumentType(value) : value),
  z.enum(["invoice", "bill", "receipt"])
);

export const bankTransactionTypeSchema = z.enum(["credit", "debit"]);

export const stringFieldSchema = extractedFieldSchema(z.string().min(1));
export const dateFieldSchema = extractedFieldSchema(isoDateSchema);
export const amountFieldSchema = extractedFieldSchema(nonNegativeNumberSchema);
export const signedAmountFieldSchema = extractedFieldSchema(finiteNumberSchema);
export const percentageFieldSchema = extractedFieldSchema(percentageSchema);

export const commercialLineItemExtractionSchema = z
  .object({
    description: stringFieldSchema.optional(),
    hsnSac: stringFieldSchema.optional(),
    quantity: extractedFieldSchema(nonNegativeNumberSchema).optional(),
    unit: stringFieldSchema.optional(),
    unitPrice: amountFieldSchema.optional(),
    taxableValue: amountFieldSchema.optional(),
    cgstRate: percentageFieldSchema.optional(),
    sgstRate: percentageFieldSchema.optional(),
    igstRate: percentageFieldSchema.optional(),
    cessRate: percentageFieldSchema.optional(),
    taxAmount: amountFieldSchema.optional(),
    totalAmount: amountFieldSchema.optional()
  })
  .strict();

export const invoiceBillReceiptExtractionSchema = z
  .object({
    documentType: extractedFieldSchema(commercialDocumentTypeSchema).optional(),
    documentNumber: stringFieldSchema.optional(),
    documentDate: dateFieldSchema.optional(),
    dueDate: dateFieldSchema.optional(),
    supplierName: stringFieldSchema.optional(),
    supplierGstin: stringFieldSchema.optional(),
    supplierAddress: stringFieldSchema.optional(),
    buyerName: stringFieldSchema.optional(),
    buyerGstin: stringFieldSchema.optional(),
    buyerAddress: stringFieldSchema.optional(),
    placeOfSupply: stringFieldSchema.optional(),
    currency: extractedFieldSchema(z.preprocess(
      (value) => (typeof value === "string" ? value.toUpperCase() : value),
      z.string().regex(/^[A-Z]{3}$/)
    )).optional(),
    subtotal: amountFieldSchema.optional(),
    discountTotal: amountFieldSchema.optional(),
    taxableValue: amountFieldSchema.optional(),
    cgstTotal: amountFieldSchema.optional(),
    sgstTotal: amountFieldSchema.optional(),
    igstTotal: amountFieldSchema.optional(),
    cessTotal: amountFieldSchema.optional(),
    totalTax: amountFieldSchema.optional(),
    totalAmount: amountFieldSchema.optional(),
    roundOff: signedAmountFieldSchema.optional(),
    paymentTerms: stringFieldSchema.optional(),
    notes: stringFieldSchema.optional(),
    lineItems: z.array(commercialLineItemExtractionSchema).default([])
  })
  .strict();

export const invoiceExtractionSchema = invoiceBillReceiptExtractionSchema.extend({
  documentType: extractedFieldSchema(z.literal("invoice")).optional()
});

export const billExtractionSchema = invoiceBillReceiptExtractionSchema.extend({
  documentType: extractedFieldSchema(z.literal("bill")).optional()
});

export const receiptExtractionSchema = invoiceBillReceiptExtractionSchema.extend({
  documentType: extractedFieldSchema(z.literal("receipt")).optional()
});

export type CommercialLineItemExtraction = z.infer<
  typeof commercialLineItemExtractionSchema
>;
export type InvoiceBillReceiptExtraction = z.infer<
  typeof invoiceBillReceiptExtractionSchema
>;
export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;
export type BillExtraction = z.infer<typeof billExtractionSchema>;
export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

export const bankStatementTransactionSchema = z
  .object({
    transactionDate: dateFieldSchema.optional(),
    valueDate: dateFieldSchema.optional(),
    description: stringFieldSchema.optional(),
    reference: stringFieldSchema.optional(),
    type: extractedFieldSchema(bankTransactionTypeSchema).optional(),
    amount: amountFieldSchema.optional(),
    balanceAfterTransaction: signedAmountFieldSchema.optional(),
    counterparty: stringFieldSchema.optional(),
    upiId: stringFieldSchema.optional(),
    chequeNumber: stringFieldSchema.optional(),
    categoryHint: stringFieldSchema.optional()
  })
  .strict();

export const bankStatementExtractionSchema = z
  .object({
    bankName: stringFieldSchema.optional(),
    branchName: stringFieldSchema.optional(),
    accountHolderName: stringFieldSchema.optional(),
    accountNumber: stringFieldSchema.optional(),
    ifsc: extractedFieldSchema(
      z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    ).optional(),
    statementPeriodStart: dateFieldSchema.optional(),
    statementPeriodEnd: dateFieldSchema.optional(),
    currency: extractedFieldSchema(z.preprocess(
      (value) => (typeof value === "string" ? value.toUpperCase() : value),
      z.string().regex(/^[A-Z]{3}$/)
    )).optional(),
    openingBalance: signedAmountFieldSchema.optional(),
    closingBalance: signedAmountFieldSchema.optional(),
    transactions: z.array(bankStatementTransactionSchema).default([])
  })
  .strict();

export type BankStatementTransaction = z.infer<
  typeof bankStatementTransactionSchema
>;
export type BankStatementExtraction = z.infer<
  typeof bankStatementExtractionSchema
>;

function normalizeDocumentType(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "_");
  if (normalized.includes("invoice")) return "invoice";
  if (normalized.includes("bill")) return "bill";
  if (normalized.includes("receipt")) return "receipt";
  return normalized;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-]((?:20)?\d{2})$/);
  if (!parts) return null;

  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const yearToken = parts[3] ?? "";
  const year = yearToken.length === 2 ? `20${yearToken}` : yearToken;
  const monthFirst = first <= 12;
  const month = monthFirst ? first : second;
  const day = monthFirst ? second : first;

  if (month < 1 || month > 12 || day < 1 || day > 31 || !/^20\d{2}$/.test(year)) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
