import { NextResponse } from "next/server";
import { getNorthAmericaSalesTaxData } from "@/lib/server/workspace";

export async function GET() {
  const data = await getNorthAmericaSalesTaxData();
  return NextResponse.json({
    label: "Draft sales-tax nexus output; review before registration, collection, or filing.",
    region: "NY/NJ/CT/SF",
    generatedAt: new Date().toISOString(),
    ruleVersions: data.ruleVersions,
    nexusChecks: data.nexusChecks,
    supportedJurisdictions: data.supportedJurisdictions,
    sampleSalesTax: data.sampleSalesTax,
    ctSpecialRates: data.ctSpecialRates
  });
}
