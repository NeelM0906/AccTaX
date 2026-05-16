import { AY_2026_27_RULE_METADATA } from "./metadata";
import { assertNonNegativeAmount, roundRupee } from "./slabs";

export type PresumptiveScheme = "44AD" | "44ADA";

export interface ReceiptThresholdInput {
  readonly totalGrossReceipts: number;
  readonly cashReceipts: number;
}

export interface Section44ADEligibilityInput extends ReceiptThresholdInput {
  readonly hasExcludedBusiness?: boolean;
  readonly requiredToMaintainBooksUnder44AA1?: boolean;
}

export interface Section44ADAEligibilityInput extends ReceiptThresholdInput {
  readonly isSpecifiedProfession?: boolean;
}

export interface PresumptiveEligibilityResult {
  readonly assessmentYear: "2026-27";
  readonly ruleVersion: string;
  readonly scheme: PresumptiveScheme;
  readonly eligible: boolean;
  readonly totalGrossReceipts: number;
  readonly cashReceipts: number;
  readonly cashReceiptPercentage: number;
  readonly cashReceiptsWithinFivePercent: boolean;
  readonly applicableReceiptThreshold: number;
  readonly reasons: readonly string[];
}

export interface Section44ADPresumptiveIncomeInput extends Section44ADEligibilityInput {
  readonly digitalReceipts?: number;
}

export interface Section44ADPresumptiveIncomeEstimate {
  readonly assessmentYear: "2026-27";
  readonly ruleVersion: string;
  readonly scheme: "44AD";
  readonly eligibility: PresumptiveEligibilityResult;
  readonly cashReceipts: number;
  readonly digitalReceipts: number;
  readonly deemedIncomeFromCashReceipts: number;
  readonly deemedIncomeFromDigitalReceipts: number;
  readonly deemedIncome: number;
}

export interface Section44ADAPresumptiveIncomeEstimate {
  readonly assessmentYear: "2026-27";
  readonly ruleVersion: string;
  readonly scheme: "44ADA";
  readonly eligibility: PresumptiveEligibilityResult;
  readonly deemedProfitRate: 0.5;
  readonly deemedIncome: number;
}

export type PresumptiveIncomeEstimate =
  | Section44ADPresumptiveIncomeEstimate
  | Section44ADAPresumptiveIncomeEstimate;

const CASH_RECEIPT_EXTENSION_RATIO = 0.05;
const SECTION_44AD_BASE_THRESHOLD = 20_000_000;
const SECTION_44AD_EXTENDED_THRESHOLD = 30_000_000;
const SECTION_44ADA_BASE_THRESHOLD = 5_000_000;
const SECTION_44ADA_EXTENDED_THRESHOLD = 7_500_000;
const SECTION_44AD_CASH_RATE = 0.08;
const SECTION_44AD_DIGITAL_RATE = 0.06;
const SECTION_44ADA_DEEMED_PROFIT_RATE = 0.5;

export function evaluateSection44ADEligibility(
  input: Section44ADEligibilityInput
): PresumptiveEligibilityResult {
  const prepared = prepareReceiptInput(input);
  const threshold = prepared.cashReceiptsWithinFivePercent
    ? SECTION_44AD_EXTENDED_THRESHOLD
    : SECTION_44AD_BASE_THRESHOLD;
  const reasons: string[] = [];

  if (prepared.totalGrossReceipts > threshold) {
    reasons.push(`Gross receipts exceed the Section 44AD threshold of INR ${threshold}.`);
  }

  if (input.hasExcludedBusiness === true) {
    reasons.push("Excluded business flag is set for Section 44AD.");
  }

  if (input.requiredToMaintainBooksUnder44AA1 === true) {
    reasons.push("Taxpayer is flagged as required to maintain books under Section 44AA(1).");
  }

  return buildEligibilityResult({
    scheme: "44AD",
    prepared,
    threshold,
    reasons
  });
}

export function evaluateSection44ADAEligibility(
  input: Section44ADAEligibilityInput
): PresumptiveEligibilityResult {
  const prepared = prepareReceiptInput(input);
  const threshold = prepared.cashReceiptsWithinFivePercent
    ? SECTION_44ADA_EXTENDED_THRESHOLD
    : SECTION_44ADA_BASE_THRESHOLD;
  const reasons: string[] = [];

  if (prepared.totalGrossReceipts > threshold) {
    reasons.push(`Gross receipts exceed the Section 44ADA threshold of INR ${threshold}.`);
  }

  if (input.isSpecifiedProfession === false) {
    reasons.push("Section 44ADA requires a specified profession.");
  }

  return buildEligibilityResult({
    scheme: "44ADA",
    prepared,
    threshold,
    reasons
  });
}

export function estimateSection44ADPresumptiveIncome(
  input: Section44ADPresumptiveIncomeInput
): Section44ADPresumptiveIncomeEstimate {
  const eligibility = evaluateSection44ADEligibility(input);
  const digitalReceipts = input.digitalReceipts ?? input.totalGrossReceipts - input.cashReceipts;

  assertNonNegativeAmount("digitalReceipts", digitalReceipts);

  const totalFromBreakup = input.cashReceipts + digitalReceipts;
  if (roundRupee(totalFromBreakup) !== roundRupee(input.totalGrossReceipts)) {
    throw new RangeError("cashReceipts and digitalReceipts must add up to totalGrossReceipts");
  }

  const deemedIncomeFromCashReceipts = roundRupee(input.cashReceipts * SECTION_44AD_CASH_RATE);
  const deemedIncomeFromDigitalReceipts = roundRupee(digitalReceipts * SECTION_44AD_DIGITAL_RATE);

  return {
    assessmentYear: AY_2026_27_RULE_METADATA.assessmentYear,
    ruleVersion: AY_2026_27_RULE_METADATA.ruleVersion,
    scheme: "44AD",
    eligibility,
    cashReceipts: roundRupee(input.cashReceipts),
    digitalReceipts: roundRupee(digitalReceipts),
    deemedIncomeFromCashReceipts,
    deemedIncomeFromDigitalReceipts,
    deemedIncome: deemedIncomeFromCashReceipts + deemedIncomeFromDigitalReceipts
  };
}

export function estimateSection44ADAPresumptiveIncome(
  input: Section44ADAEligibilityInput
): Section44ADAPresumptiveIncomeEstimate {
  const eligibility = evaluateSection44ADAEligibility(input);

  return {
    assessmentYear: AY_2026_27_RULE_METADATA.assessmentYear,
    ruleVersion: AY_2026_27_RULE_METADATA.ruleVersion,
    scheme: "44ADA",
    eligibility,
    deemedProfitRate: SECTION_44ADA_DEEMED_PROFIT_RATE,
    deemedIncome: roundRupee(input.totalGrossReceipts * SECTION_44ADA_DEEMED_PROFIT_RATE)
  };
}

export function estimatePresumptiveIncome(
  input:
    | ({ readonly scheme: "44AD" } & Section44ADPresumptiveIncomeInput)
    | ({ readonly scheme: "44ADA" } & Section44ADAEligibilityInput)
): PresumptiveIncomeEstimate {
  return input.scheme === "44AD"
    ? estimateSection44ADPresumptiveIncome(input)
    : estimateSection44ADAPresumptiveIncome(input);
}

interface PreparedReceiptInput {
  readonly totalGrossReceipts: number;
  readonly cashReceipts: number;
  readonly cashReceiptPercentage: number;
  readonly cashReceiptsWithinFivePercent: boolean;
}

function prepareReceiptInput(input: ReceiptThresholdInput): PreparedReceiptInput {
  assertNonNegativeAmount("totalGrossReceipts", input.totalGrossReceipts);
  assertNonNegativeAmount("cashReceipts", input.cashReceipts);

  if (input.cashReceipts > input.totalGrossReceipts) {
    throw new RangeError("cashReceipts cannot exceed totalGrossReceipts");
  }

  const cashReceiptPercentage =
    input.totalGrossReceipts === 0 ? 0 : input.cashReceipts / input.totalGrossReceipts;

  return {
    totalGrossReceipts: roundRupee(input.totalGrossReceipts),
    cashReceipts: roundRupee(input.cashReceipts),
    cashReceiptPercentage,
    cashReceiptsWithinFivePercent: cashReceiptPercentage <= CASH_RECEIPT_EXTENSION_RATIO
  };
}

function buildEligibilityResult(input: {
  readonly scheme: PresumptiveScheme;
  readonly prepared: PreparedReceiptInput;
  readonly threshold: number;
  readonly reasons: readonly string[];
}): PresumptiveEligibilityResult {
  return {
    assessmentYear: AY_2026_27_RULE_METADATA.assessmentYear,
    ruleVersion: AY_2026_27_RULE_METADATA.ruleVersion,
    scheme: input.scheme,
    eligible: input.reasons.length === 0,
    totalGrossReceipts: input.prepared.totalGrossReceipts,
    cashReceipts: input.prepared.cashReceipts,
    cashReceiptPercentage: input.prepared.cashReceiptPercentage,
    cashReceiptsWithinFivePercent: input.prepared.cashReceiptsWithinFivePercent,
    applicableReceiptThreshold: input.threshold,
    reasons: input.reasons
  };
}

