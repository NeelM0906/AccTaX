export type LedgerAccountTemplate = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  systemCategory: string;
};

export const defaultIndiaSmallBusinessChart: LedgerAccountTemplate[] = [
  { code: "1000", name: "Bank accounts", type: "asset", systemCategory: "bank" },
  { code: "1100", name: "Accounts receivable", type: "asset", systemCategory: "receivables" },
  { code: "1200", name: "GST input", type: "asset", systemCategory: "gst_input" },
  { code: "2000", name: "Accounts payable", type: "liability", systemCategory: "payables" },
  { code: "2100", name: "GST payable", type: "liability", systemCategory: "gst_payable" },
  { code: "3000", name: "Owner equity", type: "equity", systemCategory: "equity" },
  { code: "4000", name: "Sales", type: "income", systemCategory: "sales" },
  { code: "4010", name: "Professional fees", type: "income", systemCategory: "professional_fees" },
  { code: "5000", name: "Software", type: "expense", systemCategory: "software" },
  { code: "5010", name: "Travel", type: "expense", systemCategory: "travel" },
  { code: "5020", name: "Meals", type: "expense", systemCategory: "meals" },
  { code: "5030", name: "Rent", type: "expense", systemCategory: "rent" },
  { code: "5040", name: "Utilities", type: "expense", systemCategory: "utilities" },
  { code: "5050", name: "Contractor payments", type: "expense", systemCategory: "contractor_payments" },
  { code: "5060", name: "Bank charges", type: "expense", systemCategory: "bank_charges" }
];
