import { AY_2026_27_RULE_METADATA } from "./metadata";
import type { PresumptiveScheme } from "./presumptive";

export interface AdvanceTaxScheduleInput {
  readonly presumptiveScheme?: PresumptiveScheme | null;
}

export interface AdvanceTaxInstallment {
  readonly dueDate: string;
  readonly cumulativePercentDue: number;
}

export interface AdvanceTaxSchedule {
  readonly assessmentYear: "2026-27";
  readonly financialYear: "2025-26";
  readonly ruleVersion: string;
  readonly scheduleKind: "regular" | "presumptive-placeholder";
  readonly installments: readonly AdvanceTaxInstallment[];
  readonly notes: readonly string[];
}

const REGULAR_INSTALLMENTS: readonly AdvanceTaxInstallment[] = [
  { dueDate: "2025-06-15", cumulativePercentDue: 15 },
  { dueDate: "2025-09-15", cumulativePercentDue: 45 },
  { dueDate: "2025-12-15", cumulativePercentDue: 75 },
  { dueDate: "2026-03-15", cumulativePercentDue: 100 }
] as const;

const PRESUMPTIVE_INSTALLMENTS: readonly AdvanceTaxInstallment[] = [
  { dueDate: "2026-03-15", cumulativePercentDue: 100 }
] as const;

export function getAdvanceTaxInstallmentSchedule(
  input: AdvanceTaxScheduleInput = {}
): AdvanceTaxSchedule {
  const isPresumptive = input.presumptiveScheme === "44AD" || input.presumptiveScheme === "44ADA";

  return {
    assessmentYear: AY_2026_27_RULE_METADATA.assessmentYear,
    financialYear: AY_2026_27_RULE_METADATA.financialYear,
    ruleVersion: AY_2026_27_RULE_METADATA.ruleVersion,
    scheduleKind: isPresumptive ? "presumptive-placeholder" : "regular",
    installments: isPresumptive ? PRESUMPTIVE_INSTALLMENTS : REGULAR_INSTALLMENTS,
    notes: [
      "Schedule only; advance-tax applicability, assessed-tax computation, and 234B/234C interest are outside this package scope."
    ]
  };
}

