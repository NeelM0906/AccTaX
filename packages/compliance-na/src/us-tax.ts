import { addMoney, roundMoney } from "./money";
import { US_TY_2026_RULE_METADATA } from "./metadata";

export type UsFilingStatus = "single" | "married_joint" | "married_separate" | "head_of_household";

export type UsTaxBracket = {
  rate: number;
  from: number;
  to?: number;
};

export type UsFederalTaxResult = {
  filingStatus: UsFilingStatus;
  grossIncome: number;
  standardDeduction: number;
  taxableIncome: number;
  incomeTax: number;
  ruleVersion: string;
};

export type SelfEmploymentTaxInput = {
  netProfit: number;
  wagesSubjectToSocialSecurity?: number;
};

export type SelfEmploymentTaxResult = {
  netProfit: number;
  netEarnings: number;
  socialSecurityTaxableEarnings: number;
  socialSecurityTax: number;
  medicareTax: number;
  selfEmploymentTax: number;
  deductibleHalf: number;
  ruleVersion: string;
};

export type EstimatedTaxPlanInput = {
  grossIncome: number;
  businessExpenses: number;
  filingStatus: UsFilingStatus;
  federalWithholding?: number;
  estimatedPaymentsMade?: number;
  wagesSubjectToSocialSecurity?: number;
};

export type EstimatedTaxPlan = {
  netProfit: number;
  federalIncomeTax: UsFederalTaxResult;
  selfEmploymentTax: SelfEmploymentTaxResult;
  totalFederalTaxBeforePayments: number;
  remainingEstimatedTax: number;
  quarterlyInstallment: number;
  installments: Array<{ dueDate: string; amount: number; label: string }>;
  notes: string[];
  ruleVersion: string;
};

export const US_2026_STANDARD_DEDUCTION: Record<UsFilingStatus, number> = {
  single: 16_100,
  married_joint: 32_200,
  married_separate: 16_100,
  head_of_household: 24_150
};

export const US_2026_TAX_BRACKETS: Record<UsFilingStatus, UsTaxBracket[]> = {
  single: [
    { rate: 0.1, from: 0, to: 12_400 },
    { rate: 0.12, from: 12_400, to: 50_400 },
    { rate: 0.22, from: 50_400, to: 105_700 },
    { rate: 0.24, from: 105_700, to: 201_775 },
    { rate: 0.32, from: 201_775, to: 256_225 },
    { rate: 0.35, from: 256_225, to: 640_600 },
    { rate: 0.37, from: 640_600 }
  ],
  married_joint: [
    { rate: 0.1, from: 0, to: 24_800 },
    { rate: 0.12, from: 24_800, to: 100_800 },
    { rate: 0.22, from: 100_800, to: 211_400 },
    { rate: 0.24, from: 211_400, to: 403_550 },
    { rate: 0.32, from: 403_550, to: 512_450 },
    { rate: 0.35, from: 512_450, to: 768_700 },
    { rate: 0.37, from: 768_700 }
  ],
  married_separate: [
    { rate: 0.1, from: 0, to: 12_400 },
    { rate: 0.12, from: 12_400, to: 50_400 },
    { rate: 0.22, from: 50_400, to: 105_700 },
    { rate: 0.24, from: 105_700, to: 201_775 },
    { rate: 0.32, from: 201_775, to: 256_225 },
    { rate: 0.35, from: 256_225, to: 384_350 },
    { rate: 0.37, from: 384_350 }
  ],
  head_of_household: [
    { rate: 0.1, from: 0, to: 17_700 },
    { rate: 0.12, from: 17_700, to: 67_450 },
    { rate: 0.22, from: 67_450, to: 105_700 },
    { rate: 0.24, from: 105_700, to: 201_750 },
    { rate: 0.32, from: 201_750, to: 256_200 },
    { rate: 0.35, from: 256_200, to: 640_600 },
    { rate: 0.37, from: 640_600 }
  ]
};

export const US_2026_SELF_EMPLOYMENT = {
  netEarningsMultiplier: 0.9235,
  filingThreshold: 400,
  socialSecurityWageBase: 184_500,
  socialSecurityRate: 0.124,
  medicareRate: 0.029
} as const;

export const US_2026_BUSINESS_MILEAGE_RATE = 0.725;

export const US_1099K_REPORTING_THRESHOLD = {
  grossPayments: 20_000,
  transactionCount: 200
} as const;

export function calculateUsFederalIncomeTax(
  grossIncome: number,
  filingStatus: UsFilingStatus = "single"
): UsFederalTaxResult {
  const standardDeduction = US_2026_STANDARD_DEDUCTION[filingStatus];
  const taxableIncome = Math.max(0, roundMoney(grossIncome - standardDeduction));
  return {
    filingStatus,
    grossIncome: roundMoney(grossIncome),
    standardDeduction,
    taxableIncome,
    incomeTax: calculateUsSlabTax(taxableIncome, US_2026_TAX_BRACKETS[filingStatus]),
    ruleVersion: US_TY_2026_RULE_METADATA.ruleVersion
  };
}

export function calculateUsSlabTax(taxableIncome: number, brackets: readonly UsTaxBracket[]): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.from) continue;
    const upper = bracket.to ?? taxableIncome;
    const taxableAtBracket = Math.min(taxableIncome, upper) - bracket.from;
    tax += taxableAtBracket * bracket.rate;
  }
  return roundMoney(tax);
}

export function calculateSelfEmploymentTax(input: SelfEmploymentTaxInput): SelfEmploymentTaxResult {
  const netProfit = Math.max(0, roundMoney(input.netProfit));
  const netEarnings = roundMoney(netProfit * US_2026_SELF_EMPLOYMENT.netEarningsMultiplier);
  if (netEarnings < US_2026_SELF_EMPLOYMENT.filingThreshold) {
    return {
      netProfit,
      netEarnings,
      socialSecurityTaxableEarnings: 0,
      socialSecurityTax: 0,
      medicareTax: 0,
      selfEmploymentTax: 0,
      deductibleHalf: 0,
      ruleVersion: US_TY_2026_RULE_METADATA.ruleVersion
    };
  }

  const remainingSocialSecurityBase = Math.max(
    0,
    US_2026_SELF_EMPLOYMENT.socialSecurityWageBase - (input.wagesSubjectToSocialSecurity ?? 0)
  );
  const socialSecurityTaxableEarnings = Math.min(netEarnings, remainingSocialSecurityBase);
  const socialSecurityTax = roundMoney(
    socialSecurityTaxableEarnings * US_2026_SELF_EMPLOYMENT.socialSecurityRate
  );
  const medicareTax = roundMoney(netEarnings * US_2026_SELF_EMPLOYMENT.medicareRate);
  const selfEmploymentTax = addMoney(socialSecurityTax, medicareTax);

  return {
    netProfit,
    netEarnings,
    socialSecurityTaxableEarnings,
    socialSecurityTax,
    medicareTax,
    selfEmploymentTax,
    deductibleHalf: roundMoney(selfEmploymentTax * 0.5),
    ruleVersion: US_TY_2026_RULE_METADATA.ruleVersion
  };
}

export function buildUsEstimatedTaxPlan(input: EstimatedTaxPlanInput): EstimatedTaxPlan {
  const netProfit = Math.max(0, roundMoney(input.grossIncome - input.businessExpenses));
  const selfEmploymentTax = calculateSelfEmploymentTax({
    netProfit,
    wagesSubjectToSocialSecurity: input.wagesSubjectToSocialSecurity
  });
  const federalIncomeTax = calculateUsFederalIncomeTax(
    Math.max(0, netProfit - selfEmploymentTax.deductibleHalf),
    input.filingStatus
  );
  const totalFederalTaxBeforePayments = addMoney(federalIncomeTax.incomeTax, selfEmploymentTax.selfEmploymentTax);
  const remainingEstimatedTax = Math.max(
    0,
    roundMoney(totalFederalTaxBeforePayments - (input.federalWithholding ?? 0) - (input.estimatedPaymentsMade ?? 0))
  );
  const quarterlyInstallment = roundMoney(remainingEstimatedTax / 4);
  const installments = ["2026-04-15", "2026-06-15", "2026-09-15", "2027-01-15"].map((dueDate, index) => ({
    dueDate,
    amount: quarterlyInstallment,
    label: `Federal estimated payment ${index + 1}`
  }));

  return {
    netProfit,
    federalIncomeTax,
    selfEmploymentTax,
    totalFederalTaxBeforePayments,
    remainingEstimatedTax,
    quarterlyInstallment,
    installments,
    notes: [
      "Planning-only federal estimate; state and local income taxes are outside this MVP calculation.",
      "Estimated payments must be reviewed against prior-year safe-harbor and withholding facts before payment."
    ],
    ruleVersion: US_TY_2026_RULE_METADATA.ruleVersion
  };
}

export function calculateBusinessMileageDeduction(miles: number): number {
  return roundMoney(Math.max(0, miles) * US_2026_BUSINESS_MILEAGE_RATE);
}

export function evaluate1099KThreshold(grossPayments: number, transactionCount: number) {
  const meetsThreshold =
    grossPayments > US_1099K_REPORTING_THRESHOLD.grossPayments &&
    transactionCount > US_1099K_REPORTING_THRESHOLD.transactionCount;
  return {
    meetsThreshold,
    grossPayments,
    transactionCount,
    threshold: US_1099K_REPORTING_THRESHOLD,
    ruleVersion: US_TY_2026_RULE_METADATA.ruleVersion,
    note: meetsThreshold
      ? "Likely Form 1099-K reporting threshold met for third-party settlement organizations."
      : "Federal Form 1099-K reporting threshold not met; income may still be taxable."
  };
}
