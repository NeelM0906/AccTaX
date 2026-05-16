import { percentOf, roundMoney } from "./money";
import { US_TY_2026_RULE_METADATA } from "./metadata";

export type UsStateCode = "CA" | "CT" | "NJ" | "NY";

export type UsLaunchJurisdictionCode =
  | "NYC"
  | "NY_NASSAU"
  | "NY_SUFFOLK"
  | "NY_WESTCHESTER"
  | "NY_YONKERS"
  | "NJ"
  | "CT"
  | "SF";

export type TaxabilityCode =
  | "general"
  | "exempt"
  | "marketplace_facilitated"
  | "ct_computer_data_processing"
  | "ct_meals";

export type SalesTaxJurisdiction = {
  code: UsLaunchJurisdictionCode;
  state: UsStateCode;
  label: string;
  rate: number;
  reportingCode?: string;
  effectiveFrom: string;
  source: string;
  notes: string[];
};

export type UsSalesTaxLine = {
  destinationState?: UsStateCode;
  destinationJurisdiction?: UsLaunchJurisdictionCode;
  taxableAmount: number;
  taxabilityCode?: TaxabilityCode;
  exempt?: boolean;
  marketplaceFacilitated?: boolean;
};

export type UsSalesTaxCalculation = {
  destinationState: UsStateCode;
  destinationJurisdiction: UsLaunchJurisdictionCode;
  jurisdictionLabel: string;
  taxableAmount: number;
  rate: number;
  salesTax: number;
  invoiceTotal: number;
  marketplaceFacilitated: boolean;
  taxabilityCode: TaxabilityCode;
  source: string;
  note: string;
  ruleVersion: string;
};

export type NexusCheckInput = {
  state: UsStateCode;
  grossRevenue: number;
  transactionCount: number;
  marketplaceOnly?: boolean;
  hasPhysicalPresence?: boolean;
};

export type NexusCheckResult = {
  state: UsStateCode;
  grossRevenue: number;
  transactionCount: number;
  marketplaceOnly: boolean;
  hasPhysicalPresence: boolean;
  threshold: {
    revenue?: number;
    transactions?: number;
    logic: "AND" | "OR" | "REVENUE_ONLY";
    basis: string;
  };
  status: "below_threshold" | "monitor" | "registration_review";
  reasons: string[];
  ruleVersion: string;
};

export const US_LAUNCH_SALES_TAX_JURISDICTIONS: Record<UsLaunchJurisdictionCode, SalesTaxJurisdiction> = {
  NYC: {
    code: "NYC",
    state: "NY",
    label: "New York City, NY",
    rate: 8.875,
    reportingCode: "8081",
    effectiveFrom: "2025-03-01",
    source: "NY Tax Publication 718, effective March 1, 2025",
    notes: ["Includes the Metropolitan Commuter Transportation District component."]
  },
  NY_NASSAU: {
    code: "NY_NASSAU",
    state: "NY",
    label: "Nassau County, NY",
    rate: 8.625,
    reportingCode: "2811",
    effectiveFrom: "2025-03-01",
    source: "NY Tax Publication 718, effective March 1, 2025",
    notes: ["Use NY jurisdiction lookup for address-level confirmation before filing."]
  },
  NY_SUFFOLK: {
    code: "NY_SUFFOLK",
    state: "NY",
    label: "Suffolk County, NY",
    rate: 8.75,
    reportingCode: "4711",
    effectiveFrom: "2025-03-01",
    source: "NY Tax Publication 718, effective March 1, 2025",
    notes: ["Use NY jurisdiction lookup for address-level confirmation before filing."]
  },
  NY_WESTCHESTER: {
    code: "NY_WESTCHESTER",
    state: "NY",
    label: "Westchester County, NY",
    rate: 8.375,
    reportingCode: "5581",
    effectiveFrom: "2025-03-01",
    source: "NY Tax Publication 718, effective March 1, 2025",
    notes: ["Yonkers and some cities can use separate reporting codes."]
  },
  NY_YONKERS: {
    code: "NY_YONKERS",
    state: "NY",
    label: "Yonkers, NY",
    rate: 8.875,
    reportingCode: "6511",
    effectiveFrom: "2025-03-01",
    source: "NY Tax Publication 718, effective March 1, 2025",
    notes: ["City-level reporting code differs from the surrounding county."]
  },
  NJ: {
    code: "NJ",
    state: "NJ",
    label: "New Jersey statewide",
    rate: 6.625,
    effectiveFrom: "2018-01-01",
    source: "New Jersey Division of Taxation sales and use tax guidance",
    notes: ["Urban Enterprise Zone and product-specific exceptions need explicit review."]
  },
  CT: {
    code: "CT",
    state: "CT",
    label: "Connecticut statewide",
    rate: 6.35,
    effectiveFrom: "2026-01-01",
    source: "Connecticut DRS sales and use tax information",
    notes: ["Connecticut has no additional local sales taxes."]
  },
  SF: {
    code: "SF",
    state: "CA",
    label: "San Francisco, CA",
    rate: 8.625,
    effectiveFrom: "2026-04-01",
    source: "CDTFA city and county sales and use tax rates, effective April 1, 2026",
    notes: ["San Francisco city and county rates are currently the same in CDTFA tables."]
  }
};

export const US_STATE_SALES_TAX_RATES: Record<UsStateCode, number> = {
  CA: 7.25,
  CT: 6.35,
  NJ: 6.625,
  NY: 4
};

export const DEFAULT_JURISDICTION_BY_STATE: Record<UsStateCode, UsLaunchJurisdictionCode> = {
  CA: "SF",
  CT: "CT",
  NJ: "NJ",
  NY: "NYC"
};

export const US_ECONOMIC_NEXUS_THRESHOLDS: Record<
  UsStateCode,
  { revenue?: number; transactions?: number; logic: "AND" | "OR" | "REVENUE_ONLY"; basis: string }
> = {
  CA: {
    revenue: 500_000,
    logic: "REVENUE_ONLY",
    basis: "Current or preceding calendar year sales of tangible personal property delivered into California."
  },
  CT: {
    revenue: 100_000,
    transactions: 200,
    logic: "AND",
    basis: "Twelve-month Connecticut retail sales test; review DRS guidance before registration."
  },
  NJ: {
    revenue: 100_000,
    transactions: 200,
    logic: "OR",
    basis: "Current or prior calendar year New Jersey delivered sales."
  },
  NY: {
    revenue: 500_000,
    transactions: 100,
    logic: "AND",
    basis: "Immediately preceding four New York sales-tax quarters."
  }
};

export function getLaunchSalesTaxJurisdiction(code: UsLaunchJurisdictionCode): SalesTaxJurisdiction {
  return US_LAUNCH_SALES_TAX_JURISDICTIONS[code];
}

export function listLaunchSalesTaxJurisdictions(): SalesTaxJurisdiction[] {
  return Object.values(US_LAUNCH_SALES_TAX_JURISDICTIONS);
}

export function calculateUsSalesTax(line: UsSalesTaxLine): UsSalesTaxCalculation {
  const destinationJurisdiction =
    line.destinationJurisdiction ??
    (line.destinationState ? DEFAULT_JURISDICTION_BY_STATE[line.destinationState] : undefined);

  if (!destinationJurisdiction) {
    throw new Error("A supported NY/NJ/CT/SF destination jurisdiction is required.");
  }

  const jurisdiction = getLaunchSalesTaxJurisdiction(destinationJurisdiction);
  const taxabilityCode = resolveTaxabilityCode(line);
  const taxableAmount = taxabilityCode === "exempt" || line.exempt ? 0 : roundMoney(line.taxableAmount);
  const rate = resolveRateForTaxability(jurisdiction, taxabilityCode);
  const marketplaceFacilitated = Boolean(line.marketplaceFacilitated || taxabilityCode === "marketplace_facilitated");
  const salesTax = marketplaceFacilitated ? 0 : percentOf(taxableAmount, rate);

  return {
    destinationState: jurisdiction.state,
    destinationJurisdiction,
    jurisdictionLabel: jurisdiction.label,
    taxableAmount,
    rate,
    salesTax,
    invoiceTotal: roundMoney(line.taxableAmount + salesTax),
    marketplaceFacilitated,
    taxabilityCode,
    source: jurisdiction.source,
    note: buildSalesTaxNote(jurisdiction, taxabilityCode, marketplaceFacilitated),
    ruleVersion: US_TY_2026_RULE_METADATA.ruleVersion
  };
}

export function evaluateUsEconomicNexus(input: NexusCheckInput): NexusCheckResult {
  const threshold = US_ECONOMIC_NEXUS_THRESHOLDS[input.state];
  const revenueTriggered =
    threshold.revenue !== undefined &&
    (input.state === "NY" || input.state === "NJ" ? input.grossRevenue > threshold.revenue : input.grossRevenue >= threshold.revenue);
  const transactionTriggered =
    threshold.transactions !== undefined &&
    (input.state === "NY" ? input.transactionCount > threshold.transactions : input.transactionCount >= threshold.transactions);
  const triggered = evaluateThresholdLogic(threshold.logic, revenueTriggered, transactionTriggered);
  const nearRevenue =
    threshold.revenue !== undefined && input.grossRevenue >= threshold.revenue * 0.8 && !revenueTriggered;
  const nearTransactions =
    threshold.transactions !== undefined &&
    input.transactionCount >= threshold.transactions * 0.8 &&
    !transactionTriggered;
  const marketplaceOnly = Boolean(input.marketplaceOnly);
  const hasPhysicalPresence = Boolean(input.hasPhysicalPresence);
  const reasons: string[] = [];

  if (hasPhysicalPresence) reasons.push("Physical presence in the state requires registration review.");
  if (revenueTriggered) reasons.push(`Revenue ${triggerText(input.state)} ${formatThreshold(threshold.revenue)}.`);
  if (transactionTriggered) reasons.push(`Transactions meet ${formatThreshold(threshold.transactions)} threshold.`);
  if (threshold.logic === "AND" && (revenueTriggered || transactionTriggered) && !triggered) {
    reasons.push("This state requires both configured economic nexus thresholds before remote-seller registration is triggered.");
  }
  if (marketplaceOnly) reasons.push("Marketplace-only sales may be collected by the facilitator; confirm reporting obligations.");
  if (nearRevenue || nearTransactions) reasons.push("Activity is approaching the economic nexus threshold.");

  return {
    state: input.state,
    grossRevenue: roundMoney(input.grossRevenue),
    transactionCount: input.transactionCount,
    marketplaceOnly,
    hasPhysicalPresence,
    threshold,
    status: hasPhysicalPresence || triggered ? "registration_review" : nearRevenue || nearTransactions ? "monitor" : "below_threshold",
    reasons: reasons.length ? reasons : ["Below configured launch-region economic nexus threshold."],
    ruleVersion: US_TY_2026_RULE_METADATA.ruleVersion
  };
}

function resolveTaxabilityCode(line: UsSalesTaxLine): TaxabilityCode {
  if (line.exempt) return "exempt";
  if (line.marketplaceFacilitated) return "marketplace_facilitated";
  return line.taxabilityCode ?? "general";
}

function resolveRateForTaxability(jurisdiction: SalesTaxJurisdiction, taxabilityCode: TaxabilityCode): number {
  if (taxabilityCode === "exempt" || taxabilityCode === "marketplace_facilitated") return jurisdiction.rate;
  if (jurisdiction.code === "CT" && taxabilityCode === "ct_computer_data_processing") return 1;
  if (jurisdiction.code === "CT" && taxabilityCode === "ct_meals") return 7.35;
  return jurisdiction.rate;
}

function buildSalesTaxNote(
  jurisdiction: SalesTaxJurisdiction,
  taxabilityCode: TaxabilityCode,
  marketplaceFacilitated: boolean
): string {
  if (marketplaceFacilitated) {
    return `${jurisdiction.label}: marketplace-facilitated sale; verify facilitator collection certificate/reporting.`;
  }
  if (taxabilityCode === "exempt") {
    return `${jurisdiction.label}: exempt sale; keep exemption or resale evidence with the invoice.`;
  }
  if (taxabilityCode === "ct_computer_data_processing") {
    return "Connecticut special 1% rate for qualifying computer and data processing services.";
  }
  if (taxabilityCode === "ct_meals") {
    return "Connecticut meals and certain beverages rate applied.";
  }
  return `${jurisdiction.label}: launch-region rate from ${jurisdiction.source}. ${jurisdiction.notes.join(" ")}`;
}

function evaluateThresholdLogic(logic: "AND" | "OR" | "REVENUE_ONLY", revenue: boolean, transactions: boolean): boolean {
  if (logic === "REVENUE_ONLY") return revenue;
  if (logic === "AND") return revenue && transactions;
  return revenue || transactions;
}

function formatThreshold(value?: number): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : "configured";
}

function triggerText(state: UsStateCode): string {
  return state === "NY" || state === "NJ" ? "exceeds" : "meets";
}
