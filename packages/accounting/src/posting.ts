import type { ApprovedBillForPosting, ApprovedInvoiceForPosting, Posting, PostingLine } from "./types";

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateBalancedPosting(posting: Posting): boolean {
  const debit = posting.lines
    .filter((line) => line.direction === "debit")
    .reduce((sum, line) => sum + line.amount, 0);
  const credit = posting.lines
    .filter((line) => line.direction === "credit")
    .reduce((sum, line) => sum + line.amount, 0);

  return round(debit) === round(credit);
}

export function createInvoicePosting(invoice: ApprovedInvoiceForPosting): Posting {
  const tax = invoice.cgst + invoice.sgst + invoice.igst + (invoice.cess ?? 0);
  const lines: PostingLine[] = [
    {
      accountCode: "1100",
      direction: "debit",
      amount: round(invoice.total),
      memo: "Accounts receivable"
    },
    {
      accountCode: "4000",
      direction: "credit",
      amount: round(invoice.taxableValue),
      memo: "Sales"
    }
  ];

  if (tax > 0) {
    lines.push({
      accountCode: "2100",
      direction: "credit",
      amount: round(tax),
      memo: "GST payable"
    });
  }

  return {
    sourceId: invoice.id,
    sourceType: "invoice",
    transactionDate: invoice.invoiceDate,
    description: `Invoice to ${invoice.customerName}`,
    lines,
    metadata: {
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      igst: invoice.igst,
      cess: invoice.cess ?? 0
    }
  };
}

export function createBillPosting(bill: ApprovedBillForPosting): Posting {
  const tax = bill.cgst + bill.sgst + bill.igst + (bill.cess ?? 0);
  const lines: PostingLine[] = [
    {
      accountCode: bill.categoryAccountCode,
      direction: "debit",
      amount: round(bill.taxableValue),
      memo: "Expense"
    },
    {
      accountCode: "2000",
      direction: "credit",
      amount: round(bill.total),
      memo: "Accounts payable"
    }
  ];

  if (tax > 0) {
    lines.push({
      accountCode: bill.itcEligible ? "1200" : bill.categoryAccountCode,
      direction: "debit",
      amount: round(tax),
      memo: bill.itcEligible ? "GST input credit" : "Non-creditable tax"
    });
  }

  return {
    sourceId: bill.id,
    sourceType: "bill",
    transactionDate: bill.billDate,
    description: `Bill from ${bill.supplierName}`,
    lines,
    metadata: {
      itcEligible: bill.itcEligible,
      cgst: bill.cgst,
      sgst: bill.sgst,
      igst: bill.igst,
      cess: bill.cess ?? 0
    }
  };
}
