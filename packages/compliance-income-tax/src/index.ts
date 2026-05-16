export { getAdvanceTaxInstallmentSchedule } from "./advance-tax";
export { AY_2026_27_RULE_METADATA } from "./metadata";
export {
  evaluateSection44ADAEligibility,
  evaluateSection44ADEligibility,
  estimatePresumptiveIncome,
  estimateSection44ADAPresumptiveIncome,
  estimateSection44ADPresumptiveIncome
} from "./presumptive";
export {
  NEW_REGIME_SLABS_AY_2026_27,
  OLD_REGIME_SLABS_AY_2026_27_BELOW_60,
  calculateSlabTax
} from "./slabs";
export { calculateIncomeTax, calculateNewRegimeTax, calculateOldRegimeTax, compareRegimes } from "./tax";
export type { AdvanceTaxInstallment, AdvanceTaxSchedule, AdvanceTaxScheduleInput } from "./advance-tax";
export type { AssessmentYear, FinancialYear, IncomeTaxRuleMetadata, RuleSourceReference } from "./metadata";
export type {
  PresumptiveEligibilityResult,
  PresumptiveIncomeEstimate,
  PresumptiveScheme,
  ReceiptThresholdInput,
  Section44ADAEligibilityInput,
  Section44ADAPresumptiveIncomeEstimate,
  Section44ADEligibilityInput,
  Section44ADPresumptiveIncomeEstimate,
  Section44ADPresumptiveIncomeInput
} from "./presumptive";
export type { RegimeSlabSet, TaxRegime, TaxSlab } from "./slabs";
export type {
  BaseTaxInput,
  DeductionBreakup,
  IncomeTaxInput,
  RegimeComparisonInput,
  RegimeComparisonResult,
  TaxCalculationResult
} from "./tax";

