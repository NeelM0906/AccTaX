export const workspace = {
  name: "Niyati Studio",
  owner: "Asha Mehta",
  gstin: "27AAQCS4259Q1ZP",
  state: "Maharashtra",
  financialYear: "FY 2026-27",
  period: "April 2026"
};

export const dashboardMetrics = [
  {
    label: "Compliance health",
    value: "82%",
    detail: "4 validation items before April GST",
    status: "In review"
  },
  {
    label: "Documents needing review",
    value: "18",
    detail: "7 invoices, 6 bills, 5 receipts",
    status: "Needs review"
  },
  {
    label: "GST period status",
    value: "Ready in 3 steps",
    detail: "GSTR-1 draft has missing HSN/SAC warnings",
    status: "April"
  },
  {
    label: "AI actions awaiting approval",
    value: "11",
    detail: "8 category suggestions, 3 missing-info messages",
    status: "Approval"
  }
];

export const moneyMetrics = [
  { label: "Sales this month", value: 1240000, delta: "+14%" },
  { label: "Expenses this month", value: 486500, delta: "-3%" },
  { label: "Input tax credit estimate", value: 58220, delta: "Review 6 bills" },
  { label: "Receivables", value: 392000, delta: "5 invoices open" }
];

export const reviewFeed = [
  {
    title: "Vendor bill from PixelCloud has tax mismatch",
    detail: "Extracted IGST is Rs 12,600, document total implies Rs 12,240.",
    severity: "High"
  },
  {
    title: "Acme Labs invoice missing SAC",
    detail: "Service description suggests 998314, requires reviewer confirmation.",
    severity: "Medium"
  },
  {
    title: "April GSTR-3B draft changed after bank import",
    detail: "Two receipts were matched to issued invoices and receivables fell by Rs 94,400.",
    severity: "Info"
  }
];

export const documents = [
  {
    id: "doc_101",
    name: "Acme Labs - April Retainer.pdf",
    type: "Sales invoice",
    status: "needs_review",
    confidence: 0.91,
    uploadedAt: "15 May 2026",
    warnings: ["Missing SAC", "Buyer GSTIN unverified"]
  },
  {
    id: "doc_102",
    name: "PixelCloud Hosting Bill.pdf",
    type: "Purchase bill",
    status: "needs_review",
    confidence: 0.76,
    uploadedAt: "15 May 2026",
    warnings: ["Tax mismatch"]
  },
  {
    id: "doc_103",
    name: "HDFC Current Account Apr.xlsx",
    type: "Bank statement",
    status: "extracted",
    confidence: 0.88,
    uploadedAt: "14 May 2026",
    warnings: ["12 uncategorized"]
  },
  {
    id: "doc_104",
    name: "Office Rent Receipt.jpg",
    type: "Receipt",
    status: "approved",
    confidence: 0.96,
    uploadedAt: "14 May 2026",
    warnings: []
  }
];

export const extractedFields = [
  { field: "Seller", value: "Niyati Studio", confidence: 0.98, status: "valid", source: "p1: header" },
  { field: "Buyer", value: "Acme Labs Pvt Ltd", confidence: 0.94, status: "valid", source: "p1: billed to" },
  { field: "Invoice number", value: "NS/26-27/0042", confidence: 0.97, status: "valid", source: "p1: invoice block" },
  { field: "Invoice date", value: "30 Apr 2026", confidence: 0.95, status: "valid", source: "p1: invoice block" },
  { field: "SAC", value: "", confidence: 0.42, status: "needs_review", source: "p1: line 1" },
  { field: "Taxable value", value: "Rs 80,000", confidence: 0.93, status: "valid", source: "p1: totals" },
  { field: "GST", value: "Rs 14,400", confidence: 0.93, status: "valid", source: "p1: totals" }
];

export const transactions = [
  {
    date: "30 Apr 2026",
    party: "Acme Labs Pvt Ltd",
    description: "Design retainer invoice",
    category: "Professional fees",
    amount: 94400,
    gst: "IGST 18%",
    status: "Posted"
  },
  {
    date: "28 Apr 2026",
    party: "PixelCloud",
    description: "Cloud hosting bill",
    category: "Software",
    amount: -80240,
    gst: "ITC review",
    status: "Review"
  },
  {
    date: "24 Apr 2026",
    party: "HDFC Bank",
    description: "Bank charges",
    category: "Bank charges",
    amount: -590,
    gst: "CGST/SGST",
    status: "Posted"
  },
  {
    date: "18 Apr 2026",
    party: "Northstar Media",
    description: "Campaign analytics project",
    category: "Sales",
    amount: 177000,
    gst: "CGST/SGST 18%",
    status: "Posted"
  }
];

export const invoices = [
  {
    number: "NS/26-27/0042",
    customer: "Acme Labs Pvt Ltd",
    date: "30 Apr 2026",
    taxable: 80000,
    tax: 14400,
    total: 94400,
    status: "Draft"
  },
  {
    number: "NS/26-27/0041",
    customer: "Northstar Media",
    date: "18 Apr 2026",
    taxable: 150000,
    tax: 27000,
    total: 177000,
    status: "Issued"
  },
  {
    number: "NS/26-27/0040",
    customer: "Kaveri Foods",
    date: "11 Apr 2026",
    taxable: 120000,
    tax: 21600,
    total: 141600,
    status: "Paid"
  }
];

export const gstSummary = {
  gstr1: {
    b2bTaxable: 350000,
    b2cTaxable: 82000,
    exportTaxable: 0,
    tax: 77760
  },
  gstr3b: {
    outwardTaxable: 432000,
    outwardTax: 77760,
    itcAvailable: 58220,
    netPayable: 19540
  },
  validations: [
    "2 invoices missing HSN/SAC",
    "1 buyer GSTIN pending verification",
    "1 purchase bill tax mismatch",
    "April period is unlocked"
  ]
};

export const taxPlanner = {
  income: 1825000,
  expenses: 642000,
  professionalReceipts: 1825000,
  cashReceiptPercent: 1.8,
  presumptive: {
    section: "44ADA",
    eligible: true,
    deemedProfit: 912500,
    reason: "Professional receipts are under the extended Rs 75 lakh threshold with cash receipts below 5%."
  },
  regimes: [
    { name: "New regime", tax: 68250, note: "Default for business/profession taxpayers unless opted out." },
    { name: "Old regime", tax: 94750, note: "Includes placeholder deductions input for planning." }
  ]
};

export const assistantSuggestions = [
  {
    title: "Classify PixelCloud as software expense",
    source: "Bill doc_102 and 4 historical transactions",
    action: "Update category after approval"
  },
  {
    title: "Ask Acme Labs for GSTIN confirmation",
    source: "GSTR-1 validation GSTIN_UNVERIFIED",
    action: "Draft client message"
  },
  {
    title: "Create April GST review task",
    source: "Open validations in April 2026 period",
    action: "Create task"
  }
];

export const aiModelOptions = [
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o-mini",
  "gpt-4o",
  "o4-mini",
  "o3",
  "custom model id"
];
