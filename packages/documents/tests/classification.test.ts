import { describe, expect, it } from "vitest";
import { classifyDocumentStub } from "../src/classification";

describe("classifyDocumentStub", () => {
  it("detects bank statement CSV exports by filename and ledger columns", () => {
    const result = classifyDocumentStub({
      fileName: "bank-statement-may.csv",
      contentType: "text/csv",
      textSample: "Date,Description,Debit,Credit,Balance\n15/05/2026,Client payment,0,50000,150000",
    });

    expect(result.kind).toBe("bank_statement");
  });

  it("treats invoices with due-on-receipt terms as invoices, not receipts", () => {
    const result = classifyDocumentStub({
      fileName: "invoice.jpg",
      contentType: "image/jpeg",
      textSample: "INVOICE\nJohn Doe\nInvoice number 0852\nPayment terms Due on receipt\nBill to Jane Doe\nSubtotal $100.00\nTotal $115.00"
    });

    expect(result.kind).toBe("invoice");
  });
});
