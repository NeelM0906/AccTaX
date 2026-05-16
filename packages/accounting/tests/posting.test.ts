import { describe, expect, it } from "vitest";
import {
  createBillPosting,
  createInvoicePosting,
  suggestCategory,
  validateBalancedPosting,
} from "../src";

describe("accounting posting", () => {
  it("creates a balanced invoice posting", () => {
    const posting = createInvoicePosting({
      id: "inv_1",
      invoiceDate: "2026-04-30",
      customerName: "Acme",
      taxableValue: 80_000,
      cgst: 0,
      sgst: 0,
      igst: 14_400,
      total: 94_400,
    });

    expect(validateBalancedPosting(posting)).toBe(true);
    expect(posting.lines).toContainEqual(
      expect.objectContaining({ accountCode: "2100", direction: "credit", amount: 14_400 }),
    );
  });

  it("keeps invoice postings balanced after currency rounding", () => {
    const posting = createInvoicePosting({
      id: "inv_rounding",
      invoiceDate: "2026-04-30",
      customerName: "Rounded Labs",
      taxableValue: 1000.005,
      cgst: 90.005,
      sgst: 90.005,
      igst: 0,
      total: 1180.015,
    });

    expect(validateBalancedPosting(posting)).toBe(true);
    expect(posting.lines).toEqual([
      expect.objectContaining({ accountCode: "1100", direction: "debit", amount: 1180.02 }),
      expect.objectContaining({ accountCode: "4000", direction: "credit", amount: 1000.01 }),
      expect.objectContaining({ accountCode: "2100", direction: "credit", amount: 180.01 }),
    ]);
  });

  it("does not create a GST payable line for zero-tax invoices", () => {
    const posting = createInvoicePosting({
      id: "inv_zero_tax",
      invoiceDate: "2026-04-30",
      customerName: "Export Customer",
      taxableValue: 25_000,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 25_000,
    });

    expect(validateBalancedPosting(posting)).toBe(true);
    expect(posting.lines).toHaveLength(2);
    expect(posting.lines).not.toContainEqual(expect.objectContaining({ accountCode: "2100" }));
    expect(posting.metadata).toMatchObject({ cgst: 0, sgst: 0, igst: 0, cess: 0 });
  });

  it("detects invoice postings where persisted totals do not tie out", () => {
    const posting = createInvoicePosting({
      id: "inv_bad_total",
      invoiceDate: "2026-04-30",
      customerName: "Mismatch Co",
      taxableValue: 100,
      cgst: 9,
      sgst: 9,
      igst: 0,
      total: 119,
    });

    expect(validateBalancedPosting(posting)).toBe(false);
  });

  it("posts eligible bill tax to GST input", () => {
    const posting = createBillPosting({
      id: "bill_1",
      billDate: "2026-04-20",
      supplierName: "PixelCloud",
      categoryAccountCode: "5000",
      taxableValue: 50_000,
      cgst: 4_500,
      sgst: 4_500,
      igst: 0,
      total: 59_000,
      itcEligible: true,
    });

    expect(validateBalancedPosting(posting)).toBe(true);
    expect(posting.lines).toContainEqual(
      expect.objectContaining({ accountCode: "1200", direction: "debit", amount: 9_000 }),
    );
  });

  it("capitalizes non-creditable bill GST into the expense account", () => {
    const posting = createBillPosting({
      id: "bill_non_itc",
      billDate: "2026-04-21",
      supplierName: "Hotel Stay",
      categoryAccountCode: "5010",
      taxableValue: 10_000,
      cgst: 900,
      sgst: 900,
      igst: 0,
      total: 11_800,
      itcEligible: false,
    });

    expect(validateBalancedPosting(posting)).toBe(true);
    expect(posting.lines).toContainEqual(
      expect.objectContaining({
        accountCode: "5010",
        direction: "debit",
        amount: 10_000,
        memo: "Expense",
      }),
    );
    expect(posting.lines).toContainEqual(
      expect.objectContaining({
        accountCode: "5010",
        direction: "debit",
        amount: 1800,
        memo: "Non-creditable tax",
      }),
    );
    expect(posting.lines).not.toContainEqual(expect.objectContaining({ accountCode: "1200" }));
  });

  it("treats paise-level floating point postings as balanced after rounding", () => {
    expect(
      validateBalancedPosting({
        sourceId: "manual_1",
        sourceType: "manual",
        transactionDate: "2026-04-30",
        description: "Floating point accumulation",
        lines: [
          { accountCode: "5000", direction: "debit", amount: 0.1 },
          { accountCode: "1200", direction: "debit", amount: 0.2 },
          { accountCode: "2000", direction: "credit", amount: 0.3 },
        ],
      }),
    ).toBe(true);
  });

  it("suggests practical default categories", () => {
    expect(suggestCategory("AWS cloud hosting invoice")).toBe("software");
    expect(suggestCategory("Monthly bank charge")).toBe("bank charges");
  });
});
