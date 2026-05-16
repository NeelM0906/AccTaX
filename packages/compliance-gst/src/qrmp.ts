import { GST_RULE_VERSION } from "./rule-version";
import type { SupplyClassification } from "./types";

export type QrmpTaxpayerType =
  | "regular"
  | "sez_unit"
  | "sez_developer"
  | "composition_opted_out"
  | "composition"
  | "isd"
  | "tds"
  | "tcs";

export interface QrmpEligibilityInput {
  currentYearAggregateTurnover: number;
  precedingYearAggregateTurnover?: number;
  hasFiledLastGstr3b: boolean;
  taxpayerType?: QrmpTaxpayerType;
}

export interface EligibilityResult {
  eligible: boolean;
  threshold: number;
  reasons: string[];
}

export interface GstReturnPeriod {
  fiscalYear: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  monthInQuarter: 1 | 2 | 3;
  month: number;
  year: number;
}

export interface IffEligibilityInput {
  isQrmpOpted: boolean;
  returnPeriod: string | Date;
  supplyClassification: SupplyClassification;
  documentTaxableValue: number;
  currentMonthIffTaxableValue?: number;
}

export interface IffEligibilityResult extends EligibilityResult {
  dueDate: string;
  period: GstReturnPeriod;
}

const QRMP_ALLOWED_TAXPAYER_TYPES = new Set<QrmpTaxpayerType>([
  "regular",
  "sez_unit",
  "sez_developer",
  "composition_opted_out"
]);

export function isQrmpEligible(input: QrmpEligibilityInput): EligibilityResult {
  const reasons: string[] = [];
  const threshold = GST_RULE_VERSION.thresholds.qrmpAggregateTurnover;
  const taxpayerType = input.taxpayerType ?? "regular";

  if (!QRMP_ALLOWED_TAXPAYER_TYPES.has(taxpayerType)) {
    reasons.push("TAXPAYER_TYPE_NOT_ALLOWED");
  }

  if (input.currentYearAggregateTurnover > threshold) {
    reasons.push("CURRENT_YEAR_TURNOVER_EXCEEDS_LIMIT");
  }

  if ((input.precedingYearAggregateTurnover ?? 0) > threshold) {
    reasons.push("PRECEDING_YEAR_TURNOVER_EXCEEDS_LIMIT");
  }

  if (!input.hasFiledLastGstr3b) {
    reasons.push("LAST_GSTR3B_NOT_FILED");
  }

  return {
    eligible: reasons.length === 0,
    threshold,
    reasons
  };
}

export function canUseIff(input: IffEligibilityInput): IffEligibilityResult {
  const period = getGstReturnPeriod(input.returnPeriod);
  const dueDate = getIffDueDate(input.returnPeriod);
  const reasons: string[] = [];
  const threshold = GST_RULE_VERSION.thresholds.iffMonthlyTaxableValue;
  const totalForMonth = (input.currentMonthIffTaxableValue ?? 0) + input.documentTaxableValue;

  if (!input.isQrmpOpted) {
    reasons.push("QRMP_NOT_OPTED");
  }

  if (period.monthInQuarter === 3) {
    reasons.push("IFF_NOT_AVAILABLE_FOR_M3");
  }

  if (input.supplyClassification !== "b2b" && input.supplyClassification !== "sez") {
    reasons.push("IFF_ONLY_FOR_REGISTERED_RECIPIENT_SUPPLIES");
  }

  if (totalForMonth > threshold) {
    reasons.push("IFF_MONTHLY_VALUE_EXCEEDS_LIMIT");
  }

  return {
    eligible: reasons.length === 0,
    threshold,
    reasons,
    dueDate,
    period
  };
}

export function getGstReturnPeriod(value: string | Date): GstReturnPeriod {
  const { year, month } = parseYearMonth(value);
  const fiscalYearStart = month >= 4 ? year : year - 1;
  const fiscalYear = `${fiscalYearStart}-${String((fiscalYearStart + 1) % 100).padStart(2, "0")}`;

  if (month >= 4 && month <= 6) {
    return { fiscalYear, quarter: "Q1", monthInQuarter: ((month - 4) + 1) as 1 | 2 | 3, month, year };
  }

  if (month >= 7 && month <= 9) {
    return { fiscalYear, quarter: "Q2", monthInQuarter: ((month - 7) + 1) as 1 | 2 | 3, month, year };
  }

  if (month >= 10 && month <= 12) {
    return { fiscalYear, quarter: "Q3", monthInQuarter: ((month - 10) + 1) as 1 | 2 | 3, month, year };
  }

  return { fiscalYear, quarter: "Q4", monthInQuarter: month as 1 | 2 | 3, month, year };
}

export function getIffDueDate(value: string | Date): string {
  const { year, month } = parseYearMonth(value);
  const dueMonth = month === 12 ? 1 : month + 1;
  const dueYear = month === 12 ? year + 1 : year;

  return `${dueYear}-${String(dueMonth).padStart(2, "0")}-13`;
}

function parseYearMonth(value: string | Date): { year: number; month: number } {
  if (value instanceof Date) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1
    };
  }

  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value);

  if (match === null) {
    throw new Error("Return period must be a Date or YYYY-MM/ YYYY-MM-DD string.");
  }

  const yearText = match[1];
  const monthText = match[2];

  if (yearText === undefined || monthText === undefined) {
    throw new Error("Return period must include year and month.");
  }

  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);

  if (month < 1 || month > 12) {
    throw new Error("Return period month must be between 01 and 12.");
  }

  return { year, month };
}

