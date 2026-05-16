import { describe, expect, it } from "vitest";
import {
  bankStatementExtractionSchema,
  bankStatementTransactionSchema,
  invoiceBillReceiptExtractionSchema,
  validateInvoiceBillReceiptExtraction
} from "../src";

describe("invoice, bill, and receipt extraction schema", () => {
  it("rejects extracted fields with the wrong value type", () => {
    const result = invoiceBillReceiptExtractionSchema.safeParse({
      documentType: { value: "invoice", confidence: 0.95 },
      totalAmount: { value: "1000.00", confidence: 0.9 }
    });

    expect(result.success).toBe(false);
  });
});

describe("deterministic extraction validation", () => {
  const completeInvoice = {
    documentType: { value: "invoice" as const, confidence: 0.96 },
    documentNumber: { value: "INV-001", confidence: 0.96 },
    documentDate: { value: "2026-04-30", confidence: 0.96 },
    supplierName: { value: "Example Traders", confidence: 0.96 },
    totalAmount: { value: 1180, confidence: 0.96 },
    lineItems: []
  };

  it("marks low-confidence extracted fields for review", () => {
    const parsed = invoiceBillReceiptExtractionSchema.parse({
      ...completeInvoice,
      totalAmount: { value: 1180, confidence: 0.41 }
    });

    const validation = validateInvoiceBillReceiptExtraction(parsed, {
      confidenceThreshold: 0.75
    });

    expect(validation.status).toBe("needs_review");
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "low_confidence",
          path: "totalAmount",
          severity: "warning",
          confidence: 0.41,
          threshold: 0.75
        })
      ])
    );
  });

  it("warns on invalid GSTIN shape without schema rejection", () => {
    const parsed = invoiceBillReceiptExtractionSchema.parse({
      ...completeInvoice,
      supplierGstin: { value: "NOT-A-GSTIN", confidence: 0.98 }
    });

    const validation = validateInvoiceBillReceiptExtraction(parsed);

    expect(validation.status).toBe("needs_review");
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_gstin_shape",
          path: "supplierGstin",
          severity: "warning"
        })
      ])
    );
  });
});

describe("bank statement extraction schema", () => {
  it("accepts typed bank statement transactions", () => {
    const transaction = {
      transactionDate: { value: "2026-04-01", confidence: 0.92 },
      description: { value: "UPI payment to vendor", confidence: 0.88 },
      reference: { value: "UPI/612345678901", confidence: 0.8 },
      type: { value: "debit", confidence: 0.9 },
      amount: { value: 1250.5, confidence: 0.91 },
      balanceAfterTransaction: { value: 48749.5, confidence: 0.87 }
    };

    expect(bankStatementTransactionSchema.safeParse(transaction).success).toBe(
      true
    );

    const statement = bankStatementExtractionSchema.safeParse({
      bankName: { value: "Example Bank", confidence: 0.9 },
      accountNumber: { value: "1234567890", confidence: 0.89 },
      statementPeriodStart: { value: "2026-04-01", confidence: 0.94 },
      statementPeriodEnd: { value: "2026-04-30", confidence: 0.94 },
      transactions: [transaction]
    });

    expect(statement.success).toBe(true);
  });

  it("rejects bank transactions with non-numeric amounts", () => {
    const result = bankStatementTransactionSchema.safeParse({
      amount: { value: "1250.50", confidence: 0.91 }
    });

    expect(result.success).toBe(false);
  });
});
