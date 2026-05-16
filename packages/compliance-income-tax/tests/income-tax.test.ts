import { describe, expect, it } from "vitest";

import {
  calculateIncomeTax,
  calculateSlabTax,
  compareRegimes,
  evaluateSection44ADAEligibility,
  evaluateSection44ADEligibility,
  estimateSection44ADAPresumptiveIncome,
  estimateSection44ADPresumptiveIncome,
  getAdvanceTaxInstallmentSchedule,
  NEW_REGIME_SLABS_AY_2026_27,
} from "../src";

describe("AY 2026-27 new-regime slabs", () => {
  it("handles slab boundaries deterministically", () => {
    expect(calculateSlabTax(400_000, NEW_REGIME_SLABS_AY_2026_27.slabs)).toBe(0);
    expect(calculateSlabTax(800_000, NEW_REGIME_SLABS_AY_2026_27.slabs)).toBe(20_000);
    expect(calculateSlabTax(1_200_000, NEW_REGIME_SLABS_AY_2026_27.slabs)).toBe(60_000);
    expect(calculateSlabTax(1_600_000, NEW_REGIME_SLABS_AY_2026_27.slabs)).toBe(120_000);
    expect(calculateSlabTax(2_400_000, NEW_REGIME_SLABS_AY_2026_27.slabs)).toBe(300_000);
    expect(calculateSlabTax(2_500_000, NEW_REGIME_SLABS_AY_2026_27.slabs)).toBe(330_000);
  });

  it("applies rebate and marginal relief only where supported", () => {
    const atLimit = calculateIncomeTax({
      regime: "new",
      grossIncome: 1_200_000,
      includeCess: false,
    });
    expect(atLimit.slabTax).toBe(60_000);
    expect(atLimit.rebate).toBe(60_000);
    expect(atLimit.totalTax).toBe(0);

    const marginal = calculateIncomeTax({
      regime: "new",
      grossIncome: 1_210_000,
      includeCess: false,
    });
    expect(marginal.slabTax).toBe(61_500);
    expect(marginal.marginalRelief).toBe(51_500);
    expect(marginal.taxAfterRebateAndRelief).toBe(10_000);
  });

  it("keeps special-rate tax outside the normal-income rebate path", () => {
    const result = calculateIncomeTax({
      regime: "new",
      grossIncome: 1_000_000,
      specialRateIncome: 100_000,
      specialRateTax: 10_000,
      includeCess: false,
    });

    expect(result.normalRateIncome).toBe(900_000);
    expect(result.specialRateIncome).toBe(100_000);
    expect(result.slabTax).toBe(30_000);
    expect(result.rebate).toBe(30_000);
    expect(result.marginalRelief).toBe(0);
    expect(result.taxAfterRebateAndRelief).toBe(10_000);
    expect(result.totalTax).toBe(10_000);
    expect(result.notes).toContain(
      "Section 87A rebate and marginal relief are applied only to normal-rate income; provided special-rate tax is not offset.",
    );
  });
});

describe("Section 44AD eligibility and deemed income", () => {
  it("uses the 3 crore threshold when cash receipts are not more than 5 percent", () => {
    const eligible = evaluateSection44ADEligibility({
      totalGrossReceipts: 30_000_000,
      cashReceipts: 1_500_000,
    });
    expect(eligible.cashReceiptsWithinFivePercent).toBe(true);
    expect(eligible.applicableReceiptThreshold).toBe(30_000_000);
    expect(eligible.eligible).toBe(true);

    const ineligible = evaluateSection44ADEligibility({
      totalGrossReceipts: 25_000_000,
      cashReceipts: 1_250_001,
    });
    expect(ineligible.cashReceiptsWithinFivePercent).toBe(false);
    expect(ineligible.applicableReceiptThreshold).toBe(20_000_000);
    expect(ineligible.eligible).toBe(false);
  });

  it("estimates 44AD deemed income at 8 percent cash and 6 percent digital receipts", () => {
    const estimate = estimateSection44ADPresumptiveIncome({
      totalGrossReceipts: 10_000_000,
      cashReceipts: 1_000_000,
      digitalReceipts: 9_000_000,
    });

    expect(estimate.deemedIncomeFromCashReceipts).toBe(80_000);
    expect(estimate.deemedIncomeFromDigitalReceipts).toBe(540_000);
    expect(estimate.deemedIncome).toBe(620_000);
  });
});

describe("Section 44ADA eligibility and deemed income", () => {
  it("uses the 75 lakh threshold when cash receipts are not more than 5 percent", () => {
    const eligible = evaluateSection44ADAEligibility({
      totalGrossReceipts: 7_500_000,
      cashReceipts: 375_000,
    });
    expect(eligible.cashReceiptsWithinFivePercent).toBe(true);
    expect(eligible.applicableReceiptThreshold).toBe(7_500_000);
    expect(eligible.eligible).toBe(true);

    const ineligible = evaluateSection44ADAEligibility({
      totalGrossReceipts: 6_000_000,
      cashReceipts: 300_001,
    });
    expect(ineligible.cashReceiptsWithinFivePercent).toBe(false);
    expect(ineligible.applicableReceiptThreshold).toBe(5_000_000);
    expect(ineligible.eligible).toBe(false);
  });

  it("estimates 44ADA deemed income at 50 percent of gross receipts", () => {
    const estimate = estimateSection44ADAPresumptiveIncome({
      totalGrossReceipts: 7_500_000,
      cashReceipts: 375_000,
    });

    expect(estimate.deemedProfitRate).toBe(0.5);
    expect(estimate.deemedIncome).toBe(3_750_000);
  });
});

describe("old/new regime comparison", () => {
  it("recommends the lower total tax regime", () => {
    const newBetter = compareRegimes({
      grossIncome: 1_500_000,
      oldRegimeDeductions: { chapterVIA: 300_000 },
    });
    expect(newBetter.recommendedRegime).toBe("new");
    expect(newBetter.newRegime.totalTax).toBeLessThan(newBetter.oldRegime.totalTax);

    const oldBetter = compareRegimes({
      grossIncome: 1_500_000,
      oldRegimeDeductions: { chapterVIA: 800_000 },
    });
    expect(oldBetter.recommendedRegime).toBe("old");
    expect(oldBetter.oldRegime.totalTax).toBeLessThan(oldBetter.newRegime.totalTax);
  });

  it("returns signed tax differences using old total minus new total", () => {
    const newBetter = compareRegimes({
      grossIncome: 1_500_000,
      oldRegimeDeductions: { chapterVIA: 300_000 },
    });

    expect(newBetter.oldRegime.totalTax).toBe(179_400);
    expect(newBetter.newRegime.totalTax).toBe(109_200);
    expect(newBetter.taxDifference).toBe(70_200);
    expect(newBetter.recommendedRegime).toBe("new");

    const oldBetter = compareRegimes({
      grossIncome: 1_500_000,
      oldRegimeDeductions: { chapterVIA: 800_000 },
    });

    expect(oldBetter.oldRegime.totalTax).toBe(54_600);
    expect(oldBetter.newRegime.totalTax).toBe(109_200);
    expect(oldBetter.taxDifference).toBe(-54_600);
    expect(oldBetter.recommendedRegime).toBe("old");
  });

  it("reports a tie when both regimes have the same total tax", () => {
    const result = compareRegimes({ grossIncome: 400_000 });

    expect(result.oldRegime.totalTax).toBe(0);
    expect(result.newRegime.totalTax).toBe(0);
    expect(result.taxDifference).toBe(0);
    expect(result.recommendedRegime).toBe("tie");
  });
});

describe("advance-tax schedule placeholder", () => {
  it("returns regular and presumptive installment schedules", () => {
    expect(getAdvanceTaxInstallmentSchedule().installments).toEqual([
      { dueDate: "2025-06-15", cumulativePercentDue: 15 },
      { dueDate: "2025-09-15", cumulativePercentDue: 45 },
      { dueDate: "2025-12-15", cumulativePercentDue: 75 },
      { dueDate: "2026-03-15", cumulativePercentDue: 100 },
    ]);

    expect(getAdvanceTaxInstallmentSchedule({ presumptiveScheme: "44ADA" }).installments).toEqual([
      { dueDate: "2026-03-15", cumulativePercentDue: 100 },
    ]);
  });
});
