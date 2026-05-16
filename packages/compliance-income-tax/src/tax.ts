import { AY_2026_27_RULE_METADATA } from "./metadata";
import {
  NEW_REGIME_SLABS_AY_2026_27,
  OLD_REGIME_SLABS_AY_2026_27_BELOW_60,
  assertNonNegativeAmount,
  calculateSlabTax,
  roundRupee
} from "./slabs";
import type { TaxRegime } from "./slabs";

export interface DeductionBreakup {
  readonly standardDeduction?: number;
  readonly chapterVIA?: number;
  readonly professionalTax?: number;
  readonly other?: number;
}

export interface BaseTaxInput {
  readonly grossIncome: number;
  readonly deductions?: DeductionBreakup;
  readonly isResidentIndividual?: boolean;
  readonly specialRateIncome?: number;
  readonly specialRateTax?: number;
  readonly includeCess?: boolean;
}

export interface IncomeTaxInput extends BaseTaxInput {
  readonly regime: TaxRegime;
}

export interface TaxCalculationResult {
  readonly assessmentYear: "2026-27";
  readonly ruleVersion: string;
  readonly regime: TaxRegime;
  readonly grossIncome: number;
  readonly deductions: number;
  readonly taxableIncome: number;
  readonly normalRateIncome: number;
  readonly specialRateIncome: number;
  readonly slabTax: number;
  readonly specialRateTax: number;
  readonly rebate: number;
  readonly marginalRelief: number;
  readonly taxAfterRebateAndRelief: number;
  readonly cess: number;
  readonly totalTax: number;
  readonly notes: readonly string[];
}

export interface RegimeComparisonInput {
  readonly grossIncome: number;
  readonly isResidentIndividual?: boolean;
  readonly oldRegimeDeductions?: DeductionBreakup;
  readonly newRegimeDeductions?: DeductionBreakup;
  readonly specialRateIncome?: number;
  readonly specialRateTax?: number;
  readonly includeCess?: boolean;
}

export interface RegimeComparisonResult {
  readonly assessmentYear: "2026-27";
  readonly ruleVersion: string;
  readonly oldRegime: TaxCalculationResult;
  readonly newRegime: TaxCalculationResult;
  readonly recommendedRegime: TaxRegime | "tie";
  readonly taxDifference: number;
}

const CESS_RATE = 0.04;
const NEW_REGIME_REBATE_LIMIT = 1_200_000;
const NEW_REGIME_REBATE_MAX = 60_000;
const OLD_REGIME_REBATE_LIMIT = 500_000;
const OLD_REGIME_REBATE_MAX = 12_500;

export function calculateIncomeTax(input: IncomeTaxInput): TaxCalculationResult {
  return input.regime === "new" ? calculateNewRegimeTax(input) : calculateOldRegimeTax(input);
}

export function calculateNewRegimeTax(input: BaseTaxInput): TaxCalculationResult {
  const prepared = prepareTaxInput(input);
  const slabTax = calculateSlabTax(prepared.normalRateIncome, NEW_REGIME_SLABS_AY_2026_27.slabs);
  const notes: string[] = [];

  const rebate = calculateNewRegimeRebate({
    taxableIncome: prepared.taxableIncome,
    slabTax,
    isResidentIndividual: prepared.isResidentIndividual
  });

  const marginalRelief = calculateNewRegimeMarginalRelief({
    taxableIncome: prepared.taxableIncome,
    slabTaxAfterRebate: slabTax - rebate,
    isResidentIndividual: prepared.isResidentIndividual,
    specialRateIncome: prepared.specialRateIncome,
    specialRateTax: prepared.specialRateTax
  });

  if (prepared.specialRateIncome > 0 || prepared.specialRateTax > 0) {
    notes.push(
      "Section 87A rebate and marginal relief are applied only to normal-rate income; provided special-rate tax is not offset."
    );
  }

  if (prepared.taxableIncome > 5_000_000) {
    notes.push("Surcharge and surcharge marginal relief are outside this package scope.");
  }

  return buildTaxResult({
    regime: "new",
    prepared,
    slabTax,
    rebate,
    marginalRelief,
    notes
  });
}

export function calculateOldRegimeTax(input: BaseTaxInput): TaxCalculationResult {
  const prepared = prepareTaxInput(input);
  const slabTax = calculateSlabTax(prepared.normalRateIncome, OLD_REGIME_SLABS_AY_2026_27_BELOW_60.slabs);
  const notes = ["Old regime support is a slab placeholder; exemptions must be supplied as deductions."];

  const rebate =
    prepared.isResidentIndividual && prepared.taxableIncome <= OLD_REGIME_REBATE_LIMIT
      ? Math.min(slabTax, OLD_REGIME_REBATE_MAX)
      : 0;

  if (prepared.taxableIncome > 5_000_000) {
    notes.push("Surcharge and surcharge marginal relief are outside this package scope.");
  }

  return buildTaxResult({
    regime: "old",
    prepared,
    slabTax,
    rebate,
    marginalRelief: 0,
    notes
  });
}

export function compareRegimes(input: RegimeComparisonInput): RegimeComparisonResult {
  const commonInput = {
    grossIncome: input.grossIncome,
    isResidentIndividual: input.isResidentIndividual,
    specialRateIncome: input.specialRateIncome,
    specialRateTax: input.specialRateTax,
    includeCess: input.includeCess
  };

  const oldRegime = calculateOldRegimeTax({
    ...commonInput,
    deductions: input.oldRegimeDeductions
  });
  const newRegime = calculateNewRegimeTax({
    ...commonInput,
    deductions: input.newRegimeDeductions
  });

  const taxDifference = roundRupee(oldRegime.totalTax - newRegime.totalTax);
  const recommendedRegime =
    oldRegime.totalTax === newRegime.totalTax ? "tie" : oldRegime.totalTax < newRegime.totalTax ? "old" : "new";

  return {
    assessmentYear: AY_2026_27_RULE_METADATA.assessmentYear,
    ruleVersion: AY_2026_27_RULE_METADATA.ruleVersion,
    oldRegime,
    newRegime,
    recommendedRegime,
    taxDifference
  };
}

interface PreparedTaxInput {
  readonly grossIncome: number;
  readonly deductions: number;
  readonly taxableIncome: number;
  readonly normalRateIncome: number;
  readonly specialRateIncome: number;
  readonly specialRateTax: number;
  readonly isResidentIndividual: boolean;
  readonly includeCess: boolean;
}

function prepareTaxInput(input: BaseTaxInput): PreparedTaxInput {
  assertNonNegativeAmount("grossIncome", input.grossIncome);

  const deductions = sumDeductions(input.deductions);
  const taxableIncome = Math.max(0, roundRupee(input.grossIncome - deductions));
  const specialRateIncome = input.specialRateIncome ?? 0;
  const specialRateTax = input.specialRateTax ?? 0;

  assertNonNegativeAmount("specialRateIncome", specialRateIncome);
  assertNonNegativeAmount("specialRateTax", specialRateTax);

  if (specialRateIncome > taxableIncome) {
    throw new RangeError("specialRateIncome cannot exceed taxable income");
  }

  return {
    grossIncome: roundRupee(input.grossIncome),
    deductions,
    taxableIncome,
    normalRateIncome: taxableIncome - specialRateIncome,
    specialRateIncome: roundRupee(specialRateIncome),
    specialRateTax: roundRupee(specialRateTax),
    isResidentIndividual: input.isResidentIndividual ?? true,
    includeCess: input.includeCess ?? true
  };
}

function sumDeductions(deductions: DeductionBreakup | undefined): number {
  if (!deductions) {
    return 0;
  }

  const amounts = [
    deductions.standardDeduction,
    deductions.chapterVIA,
    deductions.professionalTax,
    deductions.other
  ];
  let total = 0;

  for (const amount of amounts) {
    if (amount === undefined) {
      continue;
    }

    assertNonNegativeAmount("deduction", amount);
    total += amount;
  }

  return roundRupee(total);
}

function calculateNewRegimeRebate(input: {
  readonly taxableIncome: number;
  readonly slabTax: number;
  readonly isResidentIndividual: boolean;
}): number {
  if (!input.isResidentIndividual || input.taxableIncome > NEW_REGIME_REBATE_LIMIT) {
    return 0;
  }

  return Math.min(input.slabTax, NEW_REGIME_REBATE_MAX);
}

function calculateNewRegimeMarginalRelief(input: {
  readonly taxableIncome: number;
  readonly slabTaxAfterRebate: number;
  readonly isResidentIndividual: boolean;
  readonly specialRateIncome: number;
  readonly specialRateTax: number;
}): number {
  if (
    !input.isResidentIndividual ||
    input.taxableIncome <= NEW_REGIME_REBATE_LIMIT ||
    input.specialRateIncome > 0 ||
    input.specialRateTax > 0
  ) {
    return 0;
  }

  const incomeAboveRebateLimit = input.taxableIncome - NEW_REGIME_REBATE_LIMIT;
  return Math.max(0, roundRupee(input.slabTaxAfterRebate - incomeAboveRebateLimit));
}

function buildTaxResult(input: {
  readonly regime: TaxRegime;
  readonly prepared: PreparedTaxInput;
  readonly slabTax: number;
  readonly rebate: number;
  readonly marginalRelief: number;
  readonly notes: readonly string[];
}): TaxCalculationResult {
  const taxAfterRebateAndRelief = Math.max(
    0,
    roundRupee(input.slabTax + input.prepared.specialRateTax - input.rebate - input.marginalRelief)
  );
  const cess = input.prepared.includeCess ? roundRupee(taxAfterRebateAndRelief * CESS_RATE) : 0;

  return {
    assessmentYear: AY_2026_27_RULE_METADATA.assessmentYear,
    ruleVersion: AY_2026_27_RULE_METADATA.ruleVersion,
    regime: input.regime,
    grossIncome: input.prepared.grossIncome,
    deductions: input.prepared.deductions,
    taxableIncome: input.prepared.taxableIncome,
    normalRateIncome: input.prepared.normalRateIncome,
    specialRateIncome: input.prepared.specialRateIncome,
    slabTax: input.slabTax,
    specialRateTax: input.prepared.specialRateTax,
    rebate: input.rebate,
    marginalRelief: input.marginalRelief,
    taxAfterRebateAndRelief,
    cess,
    totalTax: taxAfterRebateAndRelief + cess,
    notes: input.notes
  };
}
