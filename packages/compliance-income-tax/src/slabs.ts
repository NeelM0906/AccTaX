import type { AssessmentYear } from "./metadata";

export type TaxRegime = "new" | "old";

export interface TaxSlab {
  readonly from: number;
  readonly to: number | null;
  readonly rate: number;
}

export interface RegimeSlabSet {
  readonly assessmentYear: AssessmentYear;
  readonly regime: TaxRegime;
  readonly slabs: readonly TaxSlab[];
}

export const NEW_REGIME_SLABS_AY_2026_27: RegimeSlabSet = {
  assessmentYear: "2026-27",
  regime: "new",
  slabs: [
    { from: 0, to: 400_000, rate: 0 },
    { from: 400_000, to: 800_000, rate: 0.05 },
    { from: 800_000, to: 1_200_000, rate: 0.1 },
    { from: 1_200_000, to: 1_600_000, rate: 0.15 },
    { from: 1_600_000, to: 2_000_000, rate: 0.2 },
    { from: 2_000_000, to: 2_400_000, rate: 0.25 },
    { from: 2_400_000, to: null, rate: 0.3 }
  ]
} as const;

export const OLD_REGIME_SLABS_AY_2026_27_BELOW_60: RegimeSlabSet = {
  assessmentYear: "2026-27",
  regime: "old",
  slabs: [
    { from: 0, to: 250_000, rate: 0 },
    { from: 250_000, to: 500_000, rate: 0.05 },
    { from: 500_000, to: 1_000_000, rate: 0.2 },
    { from: 1_000_000, to: null, rate: 0.3 }
  ]
} as const;

export function calculateSlabTax(income: number, slabs: readonly TaxSlab[]): number {
  assertNonNegativeAmount("income", income);

  let tax = 0;
  for (const slab of slabs) {
    if (income <= slab.from) {
      continue;
    }

    const slabUpper = slab.to ?? income;
    const taxableInSlab = Math.min(income, slabUpper) - slab.from;
    if (taxableInSlab > 0) {
      tax += taxableInSlab * slab.rate;
    }
  }

  return roundRupee(tax);
}

export function roundRupee(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("Amount must be a finite number");
  }

  return Math.round(value);
}

export function assertNonNegativeAmount(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

