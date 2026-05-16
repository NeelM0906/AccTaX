export type Money = number;

export type PostingLine = {
  accountCode: string;
  direction: "debit" | "credit";
  amount: Money;
  memo?: string;
};

export type Posting = {
  sourceId: string;
  sourceType: "invoice" | "bill" | "bank_transaction" | "manual";
  transactionDate: string;
  description: string;
  lines: PostingLine[];
  metadata?: Record<string, unknown>;
};

export type ApprovedInvoiceForPosting = {
  id: string;
  invoiceDate: string;
  customerName: string;
  taxableValue: Money;
  cgst: Money;
  sgst: Money;
  igst: Money;
  cess?: Money;
  total: Money;
};

export type ApprovedBillForPosting = {
  id: string;
  billDate: string;
  supplierName: string;
  categoryAccountCode: string;
  taxableValue: Money;
  cgst: Money;
  sgst: Money;
  igst: Money;
  cess?: Money;
  total: Money;
  itcEligible: boolean;
};
