import { describe, expect, it } from "vitest";

import {
  calculateBusinessMileageDeduction,
  calculateCanadianGstHst,
  calculateSelfEmploymentTax,
  calculateUsFederalIncomeTax,
  calculateUsSalesTax,
  evaluate1099KThreshold,
  evaluateCanadianSmallSupplier,
  evaluateUsEconomicNexus,
  listLaunchSalesTaxJurisdictions,
  buildUsEstimatedTaxPlan
} from "../src";

describe("US 2026 federal tax planning", () => {
  it("calculates 2026 federal income tax after standard deduction", () => {
    const result = calculateUsFederalIncomeTax(120_000, "single");

    expect(result.standardDeduction).toBe(16_100);
    expect(result.taxableIncome).toBe(103_900);
    expect(result.incomeTax).toBe(17_570);
  });

  it("calculates self-employment tax with the 92.35 percent base and wage cap", () => {
    const result = calculateSelfEmploymentTax({ netProfit: 100_000 });

    expect(result.netEarnings).toBe(92_350);
    expect(result.socialSecurityTax).toBe(11_451.4);
    expect(result.medicareTax).toBe(2_678.15);
    expect(result.selfEmploymentTax).toBe(14_129.55);
    expect(result.deductibleHalf).toBe(7_064.78);
  });

  it("zeroes self-employment tax below the $400 net-earnings threshold", () => {
    expect(calculateSelfEmploymentTax({ netProfit: 300 }).selfEmploymentTax).toBe(0);
  });

  it("builds a draft federal estimated tax plan", () => {
    const plan = buildUsEstimatedTaxPlan({
      grossIncome: 160_000,
      businessExpenses: 40_000,
      filingStatus: "single"
    });

    expect(plan.netProfit).toBe(120_000);
    expect(plan.remainingEstimatedTax).toBeGreaterThan(0);
    expect(plan.installments).toHaveLength(4);
  });

  it("calculates 2026 business mileage deduction", () => {
    expect(calculateBusinessMileageDeduction(1_234)).toBe(894.65);
  });

  it("evaluates 1099-K federal reporting threshold", () => {
    expect(evaluate1099KThreshold(20_001, 201).meetsThreshold).toBe(true);
    expect(evaluate1099KThreshold(50_000, 200).meetsThreshold).toBe(false);
  });
});

describe("US sales tax MVP rules", () => {
  it("calculates launch-region sales tax and keeps marketplace sales at zero collection", () => {
    expect(calculateUsSalesTax({ destinationJurisdiction: "NYC", taxableAmount: 1_000 }).salesTax).toBe(88.75);
    expect(calculateUsSalesTax({ destinationJurisdiction: "NJ", taxableAmount: 1_000 }).salesTax).toBe(66.25);
    expect(calculateUsSalesTax({ destinationJurisdiction: "CT", taxableAmount: 1_000 }).salesTax).toBe(63.5);
    expect(calculateUsSalesTax({ destinationJurisdiction: "SF", taxableAmount: 1_000 }).salesTax).toBe(86.25);
    expect(
      calculateUsSalesTax({
        destinationJurisdiction: "SF",
        taxableAmount: 1_000,
        marketplaceFacilitated: true
      }).salesTax
    ).toBe(0);
  });

  it("supports Connecticut special rates for common exceptions", () => {
    expect(
      calculateUsSalesTax({
        destinationJurisdiction: "CT",
        taxableAmount: 1_000,
        taxabilityCode: "ct_computer_data_processing"
      }).salesTax
    ).toBe(10);
    expect(
      calculateUsSalesTax({
        destinationJurisdiction: "CT",
        taxableAmount: 1_000,
        taxabilityCode: "ct_meals"
      }).salesTax
    ).toBe(73.5);
  });

  it("flags configured economic nexus review with state-specific threshold logic", () => {
    expect(
      evaluateUsEconomicNexus({
        state: "NJ",
        grossRevenue: 100_001,
        transactionCount: 20
      }).status
    ).toBe("registration_review");
    expect(
      evaluateUsEconomicNexus({
        state: "NY",
        grossRevenue: 525_000,
        transactionCount: 100
      }).status
    ).toBe("monitor");
    expect(
      evaluateUsEconomicNexus({
        state: "NY",
        grossRevenue: 525_000,
        transactionCount: 101
      }).status
    ).toBe("registration_review");
    expect(
      evaluateUsEconomicNexus({
        state: "CA",
        grossRevenue: 300_000,
        transactionCount: 2_000
      }).status
    ).toBe("below_threshold");
  });

  it("lists only the launch sales-tax jurisdictions", () => {
    expect(listLaunchSalesTaxJurisdictions().map((jurisdiction) => jurisdiction.code)).toEqual([
      "NYC",
      "NY_NASSAU",
      "NY_SUFFOLK",
      "NY_WESTCHESTER",
      "NY_YONKERS",
      "NJ",
      "CT",
      "SF"
    ]);
  });
});

describe("Canada GST/HST MVP rules", () => {
  it("calculates GST/HST by province", () => {
    expect(calculateCanadianGstHst(1_000, "ON").tax).toBe(130);
    expect(calculateCanadianGstHst(1_000, "NS").tax).toBe(140);
    expect(calculateCanadianGstHst(1_000, "AB").tax).toBe(50);
  });

  it("evaluates CRA small supplier registration states", () => {
    expect(
      evaluateCanadianSmallSupplier({
        currentQuarterTaxableSupplies: 31_000,
        previousFourQuarterTaxableSupplies: 31_000
      }).chargeFrom
    ).toBe("sale_that_exceeded_threshold");
    expect(
      evaluateCanadianSmallSupplier({
        currentQuarterTaxableSupplies: 10_000,
        previousFourQuarterTaxableSupplies: 31_000
      }).chargeFrom
    ).toBe("first_supply_after_month_following_quarter");
    expect(
      evaluateCanadianSmallSupplier({
        currentQuarterTaxableSupplies: 1,
        previousFourQuarterTaxableSupplies: 1,
        taxiOrRideShare: true
      }).mustRegister
    ).toBe(true);
  });
});
