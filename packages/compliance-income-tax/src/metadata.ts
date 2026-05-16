export type AssessmentYear = "2026-27";
export type FinancialYear = "2025-26";

export interface RuleSourceReference {
  readonly label: string;
  readonly url: string;
}

export interface IncomeTaxRuleMetadata {
  readonly country: "IN";
  readonly assessmentYear: AssessmentYear;
  readonly financialYear: FinancialYear;
  readonly ruleVersion: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly lastReviewedOn: string;
  readonly currency: "INR";
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly supportedScope: readonly string[];
}

export const AY_2026_27_RULE_METADATA: IncomeTaxRuleMetadata = {
  country: "IN",
  assessmentYear: "2026-27",
  financialYear: "2025-26",
  ruleVersion: "in-income-tax-ay-2026-27-v1",
  effectiveFrom: "2025-04-01",
  effectiveTo: "2026-03-31",
  lastReviewedOn: "2026-05-15",
  currency: "INR",
  sourceReferences: [
    {
      label: "Income Tax Department AY 2026-27 tax slabs, rebate, and marginal relief",
      url: "https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1"
    },
    {
      label: "Income Tax Department ITR-4 FAQ for presumptive thresholds and 44ADA deemed profit",
      url: "https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/itr%204-faqs"
    },
    {
      label: "Income Tax Department advance-tax installment percentages",
      url: "https://www.incometaxindia.gov.in/documents/20117/42998/Interest-and-Fees_2026-01-20_02-55-55_48c87c_en.pdf/20388f8c-1b6a-e849-c537-4d209d92c0ee"
    }
  ],
  supportedScope: [
    "Resident individual slab calculations for normal-rate income.",
    "New-regime Section 87A rebate and marginal relief for normal-rate income.",
    "Old-regime slab placeholder with caller-provided deductions.",
    "Section 44AD and 44ADA presumptive eligibility thresholds and income estimates.",
    "Advance-tax installment schedule metadata only; interest computation is out of scope."
  ]
} as const;

