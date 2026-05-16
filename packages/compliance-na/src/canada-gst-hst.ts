import { percentOf, roundMoney } from "./money";
import { CA_2026_RULE_METADATA } from "./metadata";

export type CanadianProvinceCode =
  | "AB"
  | "BC"
  | "MB"
  | "NB"
  | "NL"
  | "NS"
  | "NT"
  | "NU"
  | "ON"
  | "PE"
  | "QC"
  | "SK"
  | "YT";

export type CanadianGstHstCalculation = {
  province: CanadianProvinceCode;
  taxableAmount: number;
  rate: number;
  tax: number;
  total: number;
  ruleVersion: string;
};

export type CanadianSmallSupplierInput = {
  currentQuarterTaxableSupplies: number;
  previousFourQuarterTaxableSupplies: number;
  taxiOrRideShare?: boolean;
  publicServiceBody?: boolean;
};

export type CanadianSmallSupplierResult = {
  threshold: number;
  status: "small_supplier" | "register_immediately" | "register_after_quarter";
  mustRegister: boolean;
  chargeFrom: "not_required" | "sale_that_exceeded_threshold" | "first_supply_after_month_following_quarter";
  reasons: string[];
  ruleVersion: string;
};

export const CANADA_GST_HST_RATES: Record<CanadianProvinceCode, number> = {
  AB: 5,
  BC: 5,
  MB: 5,
  NB: 15,
  NL: 15,
  NS: 14,
  NT: 5,
  NU: 5,
  ON: 13,
  PE: 15,
  QC: 5,
  SK: 5,
  YT: 5
};

export function calculateCanadianGstHst(
  taxableAmount: number,
  province: CanadianProvinceCode
): CanadianGstHstCalculation {
  const amount = roundMoney(taxableAmount);
  const rate = CANADA_GST_HST_RATES[province];
  const tax = percentOf(amount, rate);
  return {
    province,
    taxableAmount: amount,
    rate,
    tax,
    total: roundMoney(amount + tax),
    ruleVersion: CA_2026_RULE_METADATA.ruleVersion
  };
}

export function evaluateCanadianSmallSupplier(
  input: CanadianSmallSupplierInput
): CanadianSmallSupplierResult {
  const threshold = input.publicServiceBody ? 50_000 : 30_000;

  if (input.taxiOrRideShare) {
    return {
      threshold,
      status: "register_immediately",
      mustRegister: true,
      chargeFrom: "sale_that_exceeded_threshold",
      reasons: ["Taxi and commercial ride-sharing businesses must register even if small suppliers."],
      ruleVersion: CA_2026_RULE_METADATA.ruleVersion
    };
  }

  if (input.currentQuarterTaxableSupplies > threshold) {
    return {
      threshold,
      status: "register_immediately",
      mustRegister: true,
      chargeFrom: "sale_that_exceeded_threshold",
      reasons: [`Current quarter taxable supplies exceed ${threshold.toLocaleString("en-CA")}.`],
      ruleVersion: CA_2026_RULE_METADATA.ruleVersion
    };
  }

  if (input.previousFourQuarterTaxableSupplies > threshold) {
    return {
      threshold,
      status: "register_after_quarter",
      mustRegister: true,
      chargeFrom: "first_supply_after_month_following_quarter",
      reasons: [`Previous four-quarter taxable supplies exceed ${threshold.toLocaleString("en-CA")}.`],
      ruleVersion: CA_2026_RULE_METADATA.ruleVersion
    };
  }

  return {
    threshold,
    status: "small_supplier",
    mustRegister: false,
    chargeFrom: "not_required",
    reasons: ["Below configured CRA small supplier threshold."],
    ruleVersion: CA_2026_RULE_METADATA.ruleVersion
  };
}
