export type WorkflowRegion = "india" | "north-america";

export type AccountingWorkflow = {
  id: string;
  title: string;
  type: "assistant" | "tabular";
  practice: string;
  source: "LedgerAI";
  prompt: string;
  columns?: Array<{
    name: string;
    format: "text" | "currency" | "date" | "status" | "yes_no" | "percent";
    prompt: string;
  }>;
};

const sharedMonthlyCloseColumns: AccountingWorkflow["columns"] = [
  {
    name: "Source",
    format: "text",
    prompt: "Identify the source document, transaction, invoice, bill, or bank feed row used for this line."
  },
  {
    name: "Counterparty",
    format: "text",
    prompt: "Extract the supplier, customer, employee, contractor, or payment counterparty."
  },
  {
    name: "Amount",
    format: "currency",
    prompt: "Extract the reviewed accounting amount and currency."
  },
  {
    name: "Category",
    format: "text",
    prompt: "Suggest the accounting category using the workspace chart of accounts."
  },
  {
    name: "Review Status",
    format: "status",
    prompt: "State whether the row is ready, needs review, blocked, duplicate, or excluded."
  }
];

export const indiaWorkflows: AccountingWorkflow[] = [
  {
    id: "india-monthly-close",
    title: "Monthly Close Review",
    type: "tabular",
    practice: "Accounting",
    source: "LedgerAI",
    prompt:
      "Review all approved documents, invoices, bills, bank transactions, and AI suggestions for the selected month. Produce a table of unresolved accounting items, missing source records, duplicate risks, and records ready to post.",
    columns: sharedMonthlyCloseColumns
  },
  {
    id: "india-gst-return-prep",
    title: "GST Return Prep",
    type: "assistant",
    practice: "GST",
    source: "LedgerAI",
    prompt:
      "Prepare the GST review brief for the selected GSTIN and period. Summarize GSTR-1 outward supplies, GSTR-3B tax liability, ITC candidates, missing GSTIN/HSN/SAC fields, tax mismatches, QRMP/IFF notes, and records that must be approved before export. Do not file anything."
  },
  {
    id: "india-itc-eligibility",
    title: "ITC Eligibility Review",
    type: "tabular",
    practice: "GST",
    source: "LedgerAI",
    prompt:
      "Review purchase bills and receipts for input tax credit eligibility. Flag blocked credits, missing supplier GSTIN, tax mismatches, missing invoice numbers, and documents that need vendor follow-up.",
    columns: [
      { name: "Supplier GSTIN", format: "text", prompt: "Extract the supplier GSTIN, or mark missing." },
      { name: "Invoice Number", format: "text", prompt: "Extract the purchase invoice or bill number." },
      { name: "Tax Amount", format: "currency", prompt: "Extract CGST, SGST, IGST, and cess total." },
      { name: "ITC Eligible", format: "yes_no", prompt: "Decide whether the record appears ITC eligible under configured rules." },
      { name: "Issue", format: "text", prompt: "Explain the blocking issue or validation warning with source evidence." }
    ]
  },
  {
    id: "india-invoice-receivables",
    title: "Invoice and Receivables Review",
    type: "tabular",
    practice: "Invoicing",
    source: "LedgerAI",
    prompt:
      "Review issued invoices, payment status, customer GSTIN, place of supply, tax split, invoice sequence, and overdue balances. Prepare follow-up actions for unpaid invoices.",
    columns: [
      { name: "Invoice", format: "text", prompt: "Identify invoice number and customer." },
      { name: "Due Date", format: "date", prompt: "Extract due date or infer from payment terms." },
      { name: "Balance", format: "currency", prompt: "Calculate open balance." },
      { name: "Tax Check", format: "status", prompt: "Validate GSTIN, place of supply, HSN/SAC, and tax split." },
      { name: "Next Action", format: "text", prompt: "Suggest reminder, correction, write-off review, or no action." }
    ]
  },
  {
    id: "india-freelancer-tax-plan",
    title: "Freelancer Tax Planning",
    type: "assistant",
    practice: "Income Tax",
    source: "LedgerAI",
    prompt:
      "Create a planning-only income-tax brief for a freelancer or professional. Summarize income, reviewed expenses, Section 44ADA/44AD eligibility, old vs new regime comparison, advance-tax reminders, and documents to send the CA. Label all outputs as draft planning."
  },
  {
    id: "india-bank-categorization",
    title: "Bank Transaction Categorization",
    type: "tabular",
    practice: "Bookkeeping",
    source: "LedgerAI",
    prompt:
      "Review imported bank statement rows and classify income, expenses, transfers, owner drawings, tax payments, refunds, and duplicates. Keep low-confidence or high-value rows in review.",
    columns: [
      { name: "Date", format: "date", prompt: "Extract transaction date." },
      { name: "Description", format: "text", prompt: "Extract bank description and reference." },
      { name: "Amount", format: "currency", prompt: "Extract debit or credit amount with sign." },
      { name: "Suggested Category", format: "text", prompt: "Suggest accounting category." },
      { name: "Confidence", format: "percent", prompt: "Estimate classification confidence." }
    ]
  },
  {
    id: "india-ca-pack",
    title: "CA Document Pack",
    type: "assistant",
    practice: "Reports",
    source: "LedgerAI",
    prompt:
      "Prepare a CA handoff pack for the selected period. Include source documents, reviewed transactions, open review items, GST draft status, tax planning summary, audit events, and missing information requests."
  },
  {
    id: "india-einvoice-ewaybill",
    title: "E-Invoice and E-Waybill Readiness",
    type: "tabular",
    practice: "GST",
    source: "LedgerAI",
    prompt:
      "Check invoices and goods movement records for e-invoice and e-waybill readiness. Flag threshold notes, missing HSN/SAC, place of supply issues, consignment value over threshold, and records needing explicit approval before external submission.",
    columns: [
      { name: "Record", format: "text", prompt: "Identify invoice or consignment record." },
      { name: "Threshold Trigger", format: "yes_no", prompt: "State if e-invoice or e-waybill threshold review is triggered." },
      { name: "Missing Fields", format: "text", prompt: "List missing compliance fields." },
      { name: "Risk", format: "status", prompt: "Classify as clear, review, or blocked." }
    ]
  }
];

export const northAmericaWorkflows: AccountingWorkflow[] = [
  {
    id: "na-monthly-close",
    title: "Monthly Close Review",
    type: "tabular",
    practice: "Accounting",
    source: "LedgerAI",
    prompt:
      "Review receipts, invoices, bank rows, contractor payments, transfers, and AI suggestions for the selected month. Produce the close review table and keep all uncertain records approval-gated.",
    columns: sharedMonthlyCloseColumns
  },
  {
    id: "na-sales-tax-nexus",
    title: "NY/NJ/CT/SF Sales Tax Nexus Review",
    type: "tabular",
    practice: "Sales Tax",
    source: "LedgerAI",
    prompt:
      "Review sales by jurisdiction for New York, New Jersey, Connecticut, and San Francisco launch coverage. Flag economic nexus thresholds, taxable sales, exempt sales, marketplace notes, and registration review items.",
    columns: [
      { name: "Jurisdiction", format: "text", prompt: "Identify NY, NJ, CT, CA/SF, or other jurisdiction." },
      { name: "Gross Sales", format: "currency", prompt: "Calculate gross sales in the period." },
      { name: "Transactions", format: "text", prompt: "Count or summarize invoice/transaction volume." },
      { name: "Nexus Status", format: "status", prompt: "Mark monitor, review, or registered." },
      { name: "Reason", format: "text", prompt: "Explain the threshold or rule reason." }
    ]
  },
  {
    id: "na-schedule-c",
    title: "Schedule C Expense Categorization",
    type: "tabular",
    practice: "Federal Tax",
    source: "LedgerAI",
    prompt:
      "Classify reviewed expenses into Schedule C style categories. Flag personal, mixed-use, meals, travel, software, contractor payments, home office, and mileage items requiring CPA review.",
    columns: [
      { name: "Vendor", format: "text", prompt: "Extract vendor or payee." },
      { name: "Amount", format: "currency", prompt: "Extract expense amount." },
      { name: "Schedule C Category", format: "text", prompt: "Suggest tax category." },
      { name: "Deductibility", format: "status", prompt: "Mark likely deductible, partial, personal, or CPA review." },
      { name: "Evidence", format: "text", prompt: "Cite the receipt, bill, or bank source." }
    ]
  },
  {
    id: "na-1099-contractor",
    title: "1099 Contractor Review",
    type: "tabular",
    practice: "Federal Tax",
    source: "LedgerAI",
    prompt:
      "Review contractor and vendor payments for 1099 readiness. Identify payees, totals, W-9 status, payment method exceptions, and forms that need CPA or owner review.",
    columns: [
      { name: "Payee", format: "text", prompt: "Identify contractor or vendor." },
      { name: "Annual Paid", format: "currency", prompt: "Total payments for the tax year." },
      { name: "W-9 Status", format: "status", prompt: "Mark collected, missing, or not required." },
      { name: "Likely 1099", format: "yes_no", prompt: "Flag whether 1099 review is likely required." },
      { name: "Follow-up", format: "text", prompt: "Draft the missing information or CPA follow-up action." }
    ]
  },
  {
    id: "na-cpa-pack",
    title: "CPA Tax Pack",
    type: "assistant",
    practice: "Reports",
    source: "LedgerAI",
    prompt:
      "Prepare a CPA handoff pack. Include income, expenses, open review records, 1099 review, sales-tax nexus monitor, federal estimated tax planning, source document list, and unresolved questions. Mark as planning-only."
  },
  {
    id: "na-cashflow",
    title: "Cashflow and Receivables Review",
    type: "tabular",
    practice: "Operations",
    source: "LedgerAI",
    prompt:
      "Review issued invoices, open balances, received payments, recurring clients, overdue receivables, and cashflow risks. Suggest owner-approved reminders and collection steps.",
    columns: [
      { name: "Client", format: "text", prompt: "Identify customer or client." },
      { name: "Open Balance", format: "currency", prompt: "Calculate open balance." },
      { name: "Age", format: "text", prompt: "State current, 1-30, 31-60, 61-90, or 90+ days." },
      { name: "Status", format: "status", prompt: "Mark current, watch, overdue, or disputed." },
      { name: "Next Action", format: "text", prompt: "Suggest reminder, call, dispute review, or no action." }
    ]
  },
  {
    id: "na-receipt-dedupe",
    title: "Receipt Deduplication Review",
    type: "tabular",
    practice: "Bookkeeping",
    source: "LedgerAI",
    prompt:
      "Find possible duplicates between uploaded receipts, card charges, bank transactions, and vendor bills. Keep all duplicate removal approval-gated.",
    columns: [
      { name: "Candidate A", format: "text", prompt: "First possible duplicate source." },
      { name: "Candidate B", format: "text", prompt: "Second possible duplicate source." },
      { name: "Amount Match", format: "yes_no", prompt: "Whether amounts match." },
      { name: "Date Distance", format: "text", prompt: "Difference between dates." },
      { name: "Action", format: "status", prompt: "Mark merge, ignore, review, or blocked." }
    ]
  }
];

export function getWorkflowCatalog(region: WorkflowRegion) {
  return region === "north-america" ? northAmericaWorkflows : indiaWorkflows;
}
