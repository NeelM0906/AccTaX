export type RuleSourceReference = {
  label: string;
  url: string;
  effectiveDate?: string;
};

export type NorthAmericaRuleMetadata = {
  ruleVersion: string;
  region: "US" | "CA";
  taxYear: string;
  sources: RuleSourceReference[];
};

export const US_TY_2026_RULE_METADATA: NorthAmericaRuleMetadata = {
  ruleVersion: "US-TY2026-IRS-2026-05-15",
  region: "US",
  taxYear: "2026",
  sources: [
    {
      label: "IRS 2026 federal tax brackets and standard deduction",
      url: "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill",
      effectiveDate: "2026-01-01"
    },
    {
      label: "IRS Publication 505 self-employment estimated tax worksheet",
      url: "https://www.irs.gov/publications/p505",
      effectiveDate: "2026-01-01"
    },
    {
      label: "IRS 2026 standard mileage rates",
      url: "https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents",
      effectiveDate: "2026-01-01"
    },
    {
      label: "IRS Form 1099-K FAQs",
      url: "https://www.irs.gov/newsroom/form-1099-k-faqs",
      effectiveDate: "2025-01-01"
    }
  ]
};

export const CA_2026_RULE_METADATA: NorthAmericaRuleMetadata = {
  ruleVersion: "CA-2026-CRA-GSTHST-2026-05-15",
  region: "CA",
  taxYear: "2026",
  sources: [
    {
      label: "CRA GST/HST registration threshold",
      url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html"
    },
    {
      label: "CRA general information for GST/HST registrants",
      url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html"
    },
    {
      label: "CRA GST/HST rates by province",
      url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html",
      effectiveDate: "2025-04-01"
    }
  ]
};
